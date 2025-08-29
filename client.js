Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    // Конфигурация
    const spaceMap = {
      517319: 517325,
      517314: 532009, 
      517324: 532011
    };
    const innFieldId = 415447;

    buttons.push({
      text: '🔗 Связать по ИНН',
      callback: async (buttonContext) => {
        try {
          // 1. Получаем API объект
          const api = buttonContext.api || buttonContext;
          
          // 2. Получаем текущую карточку
          const currentCard = await api.cards.get(buttonContext.card_id);
          if (!currentCard) {
            throw new Error('Не удалось получить данные текущей карточки');
          }
          
          // 3. Получаем значение ИНН из текущей карточки
          const innField = currentCard.custom_fields.find(field => field.id === innFieldId);
          if (!innField || !innField.value) {
            buttonContext.showNotification({
              type: 'warning',
              message: 'Поле ИНН не заполнено в текущей карточке.'
            });
            return;
          }
          
          const innValue = innField.value;
          const currentSpaceId = currentCard.space.id;
          
          // 4. Проверяем, настроено ли текущее пространство
          const searchSpaceId = spaceMap[currentSpaceId];
          if (!searchSpaceId) {
            buttonContext.showNotification({
              type: 'info', 
              message: `Пространство ${currentSpaceId} не настроено для поиска связанных карточек.`
            });
            return;
          }
          
          // 5. Ищем карточки с таким же ИНН в целевом пространстве
          buttonContext.showNotification({
            type: 'info',
            message: `Ищем карточки с ИНН ${innValue} в пространстве ${searchSpaceId}...`
          });
          
          const foundCards = await api.cards.find({
            space_id: searchSpaceId,
            custom_fields: [{
              field_id: innFieldId,
              value: innValue
            }]
          });
          
          // 6. Обрабатываем результаты
          if (!foundCards || foundCards.length === 0) {
            buttonContext.showNotification({
              type: 'info',
              message: `Карточки с ИНН ${innValue} не найдены в пространстве ${searchSpaceId}.`
            });
            return;
          }
          
          // 7. Если найдена только одна карточка - сразу связываем
          if (foundCards.length === 1) {
            const parentCard = foundCards[0];
            
            // Проверяем, не пытаемся ли мы связать карточку саму с собой
            if (parentCard.id === currentCard.id) {
              buttonContext.showNotification({
                type: 'warning',
                message: 'Нельзя связать карточку саму с собой.'
              });
              return;
            }
            
            await api.cards.update(currentCard.id, {
              parent_id: parentCard.id
            });
            
            buttonContext.showNotification({
              type: 'success',
              message: `Карточка #${parentCard.id} "${parentCard.title}" установлена как родительская.`
            });
            return;
          }
          
          // 8. Если найдено несколько карточек - показываем выбор
          const choices = foundCards
            .filter(card => card.id !== currentCard.id) // Исключаем текущую карточку
            .map(card => ({
              id: card.id,
              label: `#${card.id} - ${card.title}`
            }));
          
          if (choices.length === 0) {
            buttonContext.showNotification({
              type: 'info',
              message: 'Найдена только текущая карточка. Других карточек для связывания нет.'
            });
            return;
          }
          
          // 9. Показываем модальное окно с выбором
          const selectedChoice = await buttonContext.showChoice({
            title: `Найдено ${foundCards.length} карточек с ИНН ${innValue}`,
            message: 'Выберите карточку для установки как родительской:',
            choices: choices
          });
          
          // 10. Если пользователь выбрал карточку - устанавливаем связь
          if (selectedChoice) {
            await api.cards.update(currentCard.id, {
              parent_id: selectedChoice.id
            });
            
            const parentCard = foundCards.find(card => card.id === selectedChoice.id);
            buttonContext.showNotification({
              type: 'success',
              message: `Карточка #${parentCard.id} "${parentCard.title}" установлена как родительская.`
            });
          }
          
        } catch (error) {
          console.error('Ошибка в аддоне связывания по ИНН:', error);
          buttonContext.showNotification({
            type: 'error',
            message: `Произошла ошибка: ${error.message}`
          });
        }
      }
    });

    return buttons;
  }
});
