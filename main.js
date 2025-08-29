// Аддон для связывания счетов с договорами по ИНН
console.log('🚀 Загрузка аддона связывания счетов с договорами...');

// Настройки связывания пространств
const SPACE_CONNECTIONS = {
  517319: 517325, // Счета в пространстве 517319 → Договора в пространстве 517325
  517314: 532009, // Счета в пространстве 517314 → Договора в пространстве 532009  
  517324: 532011  // Счета в пространстве 517324 → Договора в пространстве 532011
};

// ID кастомного поля с ИНН
const INN_FIELD_ID = 415447;

// Функция поиска договоров по ИНН через API
async function findContractsByINN(api, currentCard, innValue) {
  console.log('🔍 Поиск договоров по ИНН:', innValue);

  const currentSpaceId = currentCard.space?.id || currentCard.space_id;
  const contractsSpaceId = SPACE_CONNECTIONS[currentSpaceId];
  
  if (!contractsSpaceId) {
    console.log('❌ Пространство не настроено для поиска договоров');
    return { error: `Для пространства ${currentSpaceId} не настроен поиск договоров` };
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
    return { contracts: validContracts };

  } catch (error) {
    console.error('❌ Ошибка поиска договоров:', error);
    return { error: 'Ошибка при поиске договоров. Попробуйте еще раз.' };
  }
}

// Функция связывания счета с договором
async function linkInvoiceToContract(api, invoiceId, contractId, contractTitle) {
  try {
    console.log(`🔗 Связываем счет #${invoiceId} с договором #${contractId}`);
    
    await api.cards.update(invoiceId, {
      parent_id: contractId
    });

    console.log(`✅ Успешно связаны карточки`);
    return { success: `Счет привязан к договору "${contractTitle}" (#${contractId})` };

  } catch (error) {
    console.error('❌ Ошибка связывания:', error);
    return { error: 'Не удалось привязать счет к договору. Попробуйте вручную.' };
  }
}

// Функция показа результатов поиска пользователю
async function showContractSelectionDialog(buttonContext, invoice, contracts, innValue) {
  if (contracts.length === 0) {
    buttonContext.showSnackbar(
      `❌ Договоры с ИНН ${innValue} не найдены. Проверьте корректность ИНН.`,
      'warning'
    );
    return null;
  }

  if (contracts.length === 1) {
    // Если найден только один договор - автоматически связываем
    return contracts[0];
  }

  // Если найдено несколько договоров - показываем выбор
  const contractChoices = contracts.map(contract => ({
    id: contract.id,
    label: `#${contract.id} - ${contract.title}`
  }));

  try {
    const selectedChoice = await buttonContext.showChoice({
      title: `Найдено ${contracts.length} договоров с ИНН ${innValue}`,
      message: 'Выберите договор для привязки к этому счету:',
      choices: contractChoices
    });

    if (selectedChoice) {
      return contracts.find(c => c.id === selectedChoice.id);
    }
  } catch (error) {
    console.error('❌ Ошибка выбора договора:', error);
    buttonContext.showSnackbar('Ошибка при выборе договора', 'error');
  }

  return null;
}

// Основная функция обработки поиска и связывания
async function processInvoiceINN(buttonContext, api, card, innValue) {
  console.log('💰 Обработка счета с ИНН:', innValue);
  
  // Показываем индикатор загрузки
  buttonContext.showSnackbar('🔍 Поиск договоров...', 'info');
  
  // Ищем договоры
  const searchResult = await findContractsByINN(api, card, innValue);
  
  if (searchResult.error) {
    buttonContext.showSnackbar(searchResult.error, 'warning');
    return;
  }

  // Показываем результаты пользователю
  const selectedContract = await showContractSelectionDialog(
    buttonContext, 
    card, 
    searchResult.contracts, 
    innValue
  );

  if (selectedContract) {
    // Связываем выбранный договор
    const linkResult = await linkInvoiceToContract(
      api,
      card.id, 
      selectedContract.id, 
      selectedContract.title
    );

    if (linkResult.success) {
      buttonContext.showSnackbar(linkResult.success, 'success');
    } else {
      buttonContext.showSnackbar(linkResult.error, 'error');
    }
  }
}

// Инициализация аддона
Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    console.log('🔘 Инициализация кнопок аддона');
    
    const buttons = [];

    // Кнопка для поиска и связывания с договором
    buttons.push({
      text: '🔗 Найти договор по ИНН',
      callback: async (buttonContext) => {
        try {
          console.log('🔘 Нажата кнопка поиска договора');
          
          // Получаем данные текущей карточки
          const currentCard = await buttonContext.getCard();
          console.log('📋 Данные карточки получены:', currentCard);
          
          // Получаем API для работы с карточками
          const api = await buttonContext.getApi();
          console.log('🔌 API получен');
          
          // Получаем значение ИНН
          const innKey = `id_${INN_FIELD_ID}`;
          let innValue = null;
          
          if (currentCard.properties && currentCard.properties[innKey]) {
            innValue = currentCard.properties[innKey].toString().trim();
          }
          
          // Проверяем наличие ИНН
          if (!innValue) {
            buttonContext.showSnackbar(
              '❌ Заполните поле ИНН перед поиском договора', 
              'warning'
            );
            return;
          }

          console.log('🔍 ИНН для поиска:', innValue);
          
          // Запускаем процесс поиска и связывания
          await processInvoiceINN(buttonContext, api, currentCard, innValue);

        } catch (error) {
          console.error('❌ Ошибка в кнопке поиска:', error);
          buttonContext.showSnackbar(
            'Произошла ошибка при поиске договора', 
            'error'
          );
        }
      }
    });

    console.log('✅ Кнопки аддона готовы');
    return buttons;
  }
});

console.log('✅ Аддон связывания счетов с договорами загружен успешно');
