// Аддон для связывания счетов с договорами по ИНН
kaiten.init((api) => {

  // Настройки связывания пространств
  // Ключ: ID пространства со счетами, Значение: ID пространства с договорами
  const SPACE_CONNECTIONS = {
    517319: 517325, // Счета в пространстве 517319 → Договора в пространстве 517325
    517314: 532009, // Счета в пространстве 517314 → Договора в пространстве 532009  
    517324: 532011  // Счета в пространстве 517324 → Договора в пространстве 532011
  };

  // ID кастомного поля с ИНН
  const INN_FIELD_ID = 415447;

  // Функция поиска договоров по ИНН
  async function findContractsByINN(currentCard, innValue) {
    console.log('🔍 Поиск договоров по ИНН:', innValue);

    // Определяем пространство для поиска договоров
    const currentSpaceId = currentCard.space?.id || currentCard.space_id;
    const contractsSpaceId = SPACE_CONNECTIONS[currentSpaceId];
    
    if (!contractsSpaceId) {
      console.log('❌ Пространство не настроено для поиска договоров');
      kaiten.ui.showNotification({
        type: 'warning',
        message: `Для пространства ${currentSpaceId} не настроен поиск договоров`
      });
      return [];
    }

    console.log(`📋 Ищем в пространстве договоров: ${contractsSpaceId}`);

    try {
      // Поиск карточек договоров с таким же ИНН
      const contracts = await api.cards.find({
        space_id: contractsSpaceId,
        custom_fields: [{
          field_id: INN_FIELD_ID,
          value: innValue
        }]
      });

      // Исключаем текущую карточку из результатов
      const validContracts = contracts.filter(card => card.id !== currentCard.id);
      
      console.log(`✅ Найдено договоров: ${validContracts.length}`);
      return validContracts;

    } catch (error) {
      console.error('❌ Ошибка поиска договоров:', error);
      kaiten.ui.showNotification({
        type: 'error',
        message: 'Ошибка при поиске договоров. Попробуйте еще раз.'
      });
      return [];
    }
  }

  // Функция связывания счета с договором
  async function linkInvoiceToContract(invoiceId, contractId, contractTitle) {
    try {
      console.log(`🔗 Связываем счет #${invoiceId} с договором #${contractId}`);
      
      await api.cards.update(invoiceId, {
        parent_id: contractId
      });

      kaiten.ui.showNotification({
        type: 'success',
        message: `✅ Счет привязан к договору "${contractTitle}" (#${contractId})`
      });

    } catch (error) {
      console.error('❌ Ошибка связывания:', error);
      kaiten.ui.showNotification({
        type: 'error',
        message: 'Не удалось привязать счет к договору. Попробуйте вручную.'
      });
    }
  }

  // Функция показа результатов поиска пользователю
  async function showContractSelectionDialog(invoice, contracts, innValue) {
    if (contracts.length === 0) {
      kaiten.ui.showNotification({
        type: 'info',
        message: `❌ Договоры с ИНН ${innValue} не найдены. Проверьте корректность ИНН.`
      });
      return;
    }

    if (contracts.length === 1) {
      // Если найден только один договор - автоматически связываем
      const contract = contracts[0];
      await linkInvoiceToContract(invoice.id, contract.id, contract.title);
      return;
    }

    // Если найдено несколько договоров - показываем выбор
    const contractChoices = contracts.map(contract => ({
      id: contract.id,
      label: `#${contract.id} - ${contract.title}`
    }));

    const selectedChoice = await kaiten.ui.showChoice({
      title: `Найдено ${contracts.length} договоров с ИНН ${innValue}`,
      message: 'Выберите договор для привязки к этому счету:',
      choices: contractChoices
    });

    if (selectedChoice) {
      const selectedContract = contracts.find(c => c.id === selectedChoice.id);
      await linkInvoiceToContract(invoice.id, selectedContract.id, selectedContract.title);
    }
  }

  // Основная функция обработки
  async function processInvoiceINN(card, innValue) {
    console.log('💰 Обработка счета с ИНН:', innValue);
    
    // Ищем договоры
    const contracts = await findContractsByINN(card, innValue);
    
    // Показываем результаты пользователю
    await showContractSelectionDialog(card, contracts, innValue);
  }

  // Автоматическое срабатывание при изменении поля ИНН
  kaiten.on('card.field_changed', (payload) => {
    const changedFieldId = payload.field?.id || payload.property_id || payload.field_id;
    
    // Проверяем, что изменилось именно поле ИНН и оно не пустое
    if (changedFieldId !== INN_FIELD_ID || !payload.value || !payload.value.trim()) {
      return;
    }

    console.log('📝 ИНН изменен в карточке:', payload.card.id);
    processInvoiceINN(payload.card, payload.value.trim());
  });

  // API для вызова из кнопки
  window.invoiceContractLinker = {
    findAndLink: processInvoiceINN,
    getSpaceConnections: () => SPACE_CONNECTIONS,
    getInnFieldId: () => INN_FIELD_ID
  };

  console.log('✅ Система связывания счетов с договорами запущена');
});
