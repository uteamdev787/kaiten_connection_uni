// Аддон для автоматического связывания счетов с договорами по ИНН
kaiten.init((api) => {

  // Карта связей: ID пространства счетов -> ID пространства договоров
  const spaceMap = {
    517319: 517325, // Счета в 517319 -> договоры в 517325
    517314: 532009, // Счета в 517314 -> договоры в 532009  
    517324: 532011  // Счета в 517324 -> договоры в 532011
  };

  // ID кастомного поля для ИНН
  const innFieldId = 415447;

  // Глобальное хранение для последнего поиска
  let lastSearchData = null;

  // Основная функция поиска и связывания договоров по ИНН
  async function findContractsByINN(currentCard, innValue, showResults = true) {
    console.log('🔍 Поиск договоров по ИНН:', innValue);
    
    if (!innValue || innValue.trim().length === 0) {
      return { success: false, message: 'ИНН не указан' };
    }

    // Определяем пространство для поиска договоров
    const currentSpaceId = currentCard.space?.id || currentCard.space_id;
    const contractsSpaceId = spaceMap[currentSpaceId];
    
    if (!contractsSpaceId) {
      const message = `Для пространства ${currentSpaceId} не настроен поиск договоров`;
      if (showResults) {
        kaiten.ui.showNotification({
          type: 'info',
          message: message
        });
      }
      return { success: false, message };
    }

    try {
      // Ищем договоры с таким же ИНН
      const contracts = await api.cards.find({
        space_id: contractsSpaceId,
        custom_fields: [{
          field_id: innFieldId,
          value: innValue.trim()
        }]
      });

      console.log(`📋 Найдено договоров: ${contracts.length}`);

      // Исключаем текущую карточку на случай поиска в том же пространстве
      const validContracts = contracts.filter(contract => contract.id !== currentCard.id);
      
      // Сохраняем результаты для возможного повторного использования
      lastSearchData = {
        currentCard,
        innValue: innValue.trim(),
        contracts: validContracts,
        timestamp: Date.now()
      };

      if (validContracts.length === 0) {
        const message = `Договоры с ИНН ${innValue} не найдены`;
        if (showResults) {
          kaiten.ui.showNotification({
            type: 'warning',
            message: message + '. Проверьте правильность ИНН или создайте договор.'
          });
        }
        return { success: false, message, contracts: [] };
      }

      if (showResults) {
        // Автоматически связываем, если договор один
        if (validContracts.length === 1) {
          const contract = validContracts[0];
          await linkToContract(currentCard.id, contract.id, contract.title);
          
          kaiten.ui.showNotification({
            type: 'success',
            message: `✅ Счет автоматически привязан к договору "${contract.title}"`
          });
          
          return { success: true, linkedContract: contract };
        }
        
        // Если договоров несколько - показываем выбор
        else {
          const choices = validContracts.map(contract => ({
            id: contract.id,
            label: `📄 #${contract.id} - ${contract.title}`,
            description: contract.description ? contract.description.substring(0, 100) + '...' : 'Описание отсутствует'
          }));

          const selectedChoice = await kaiten.ui.showChoice({
            title: `🔗 Найдено ${validContracts.length} договоров с ИНН ${innValue}`,
            message: 'Выберите договор для привязки счета:',
            choices: choices
          });

          if (selectedChoice) {
            const contract = validContracts.find(c => c.id === selectedChoice.id);
            await linkToContract(currentCard.id, contract.id, contract.title);
            
            kaiten.ui.showNotification({
              type: 'success',
              message: `✅ Счет привязан к договору "${contract.title}"`
            });
            
            return { success: true, linkedContract: contract };
          } else {
            return { success: false, message: 'Связывание отменено пользователем' };
          }
        }
      }

      return { success: true, contracts: validContracts };

    } catch (error) {
      console.error('❌ Ошибка поиска договоров:', error);
      const message = 'Ошибка при поиске договоров. Попробуйте позже.';
      if (showResults) {
        kaiten.ui.showNotification({
          type: 'error',
          message: message
        });
      }
      return { success: false, message, error };
    }
  }

  // Функция установки связи счета с договором
  async function linkToContract(billCardId, contractCardId, contractTitle) {
    try {
      console.log(`🔗 Связывание: счет #${billCardId} -> договор #${contractCardId}`);
      
      await api.cards.update(billCardId, {
        parent_id: contractCardId
      });

      console.log('✅ Связь установлена успешно');
      
    } catch (error) {
      console.error('❌ Ошибка связывания:', error);
      
      // Детальная информация об ошибке
      let errorMessage = 'Не удалось привязать счет к договору';
      if (error.response) {
        errorMessage += ` (${error.response.status})`;
      }
      
      kaiten.ui.showNotification({
        type: 'error',
        message: errorMessage
      });
      
      throw error;
    }
  }

  // Автоматическое срабатывание при заполнении поля ИНН
  kaiten.on('card.field_changed', async (payload) => {
    console.log('📝 Изменение поля в карточке');
    
    // Проверяем, что изменилось именно поле ИНН
    const changedFieldId = payload.field?.id || payload.property_id || payload.field_id;
    
    if (changedFieldId !== innFieldId) {
      return; // Не наше поле
    }

    const innValue = payload.value;
    
    // Проверяем, что ИНН действительно введен
    if (!innValue || innValue.trim().length === 0) {
      console.log('ℹ️ ИНН очищен или не заполнен');
      return;
    }

    console.log(`🎯 Обнаружен новый ИНН: ${innValue}`);
    
    // Небольшая задержка для завершения сохранения поля
    setTimeout(async () => {
      try {
        // Показываем уведомление о начале поиска
        kaiten.ui.showNotification({
          type: 'info',
          message: `🔍 Ищем договоры с ИНН ${innValue}...`,
          duration: 2000
        });

        await findContractsByINN(payload.card, innValue, true);
        
      } catch (error) {
        console.error('Ошибка автоматического поиска:', error);
      }
    }, 500);
  });

  // API для внешнего использования из popup
  window.kaitenContractLinker = {
    searchContracts: findContractsByINN,
    linkToContract: linkToContract,
    getLastSearchData: () => lastSearchData,
    getSpaceMapping: () => spaceMap
  };

  // Вспомогательная функция для получения текущего ИНН из карточки
  async function getCurrentINN(cardId) {
    try {
      const card = await api.cards.get(cardId);
      const innKey = `id_${innFieldId}`;
      return card.properties && card.properties[innKey];
    } catch (error) {
      console.error('Ошибка получения ИНН:', error);
      return null;
    }
  }

  console.log('🚀 Аддон связывания счетов с договорами по ИНН запущен (ручной режим)');
  console.log('📋 Настроенные пространства:', Object.keys(spaceMap).join(', '));
  console.log('🎯 Режим работы: поиск только по кнопке пользователя');
});