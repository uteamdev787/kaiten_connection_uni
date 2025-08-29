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
          console.log('Button context:', buttonContext);
          console.log('Available methods:', Object.keys(buttonContext));
          
          // 1. Получаем данные текущей карточки
          let currentCard;
          try {
            // Попробуем разные способы получить карточку
            if (buttonContext.getCard) {
              currentCard = await buttonContext.getCard();
            } else if (buttonContext.card) {
              currentCard = buttonContext.card;
            } else {
              // Используем прямой API запрос
              currentCard = await buttonContext.request({
                method: 'GET',
                url: `/cards/${buttonContext.card_id}`
              });
            }
          } catch (e) {
            console.log('Ошибка получения карточки:', e);
            throw new Error('Не удалось получить данные текущей карточки');
          }
          
          if (!currentCard) {
            throw new Error('Не удалось получить данные текущей карточки');
          }
          
          console.log('Current card:', currentCard);
          
          // 2. Получаем значение ИНН из текущей карточки
          let innField = null;
          let innValue = null;
          
          // Ищем поле ИНН в разных местах
          if (currentCard.custom_fields) {
            innField = currentCard.custom_fields.find(field => field.id === innFieldId);
          } else if (currentCard.fields) {
            innField = currentCard.fields.find(field => field.id === innFieldId);
          }
          
          if (innField) {
            innValue = innField.value;
          }
          
          if (!innValue) {
            buttonContext.showNotification({
              type: 'warning',
              message: 'Поле ИНН не заполнено в текущей карточке.'
            });
            return;
          }
          
          console.log('INN value:', innValue);
          
          // 3. Определяем пространство
          let currentSpaceId = null;
          if (currentCard.space && currentCard.space.id) {
            currentSpaceId = currentCard.space.id;
          } else if (currentCard.space_id) {
            currentSpaceId = currentCard.space_id;
          }
          
          if (!currentSpaceId) {
            throw new Error('Не удалось определить ID пространства текущей карточки');
          }
          
          console.log('Current space ID:', currentSpaceId);
          
          // 4. Проверяем, настроено ли текущее пространство
          const searchSpaceId = spaceMap[currentSpaceId];
          if (!searchSpaceId) {
            buttonContext.showNotification({
              type: 'info', 
              message: `Пространство ${currentSpaceId} не настроено для поиска связанных карточек.`
            });
            return;
          }
          
          console.log('Search space ID:', searchSpaceId);
          
          // 5. Ищем карточки с таким же ИНН в целевом пространстве
          buttonContext.showNotification({
            type: 'info',
            message: `Ищем карточки с ИНН ${innValue} в пространстве ${searchSpaceId}...`
          });
          
          let foundCards;
          try {
            // Пробуем разные способы поиска
            if (buttonContext.findCards) {
              foundCards = await buttonContext.findCards({
                space_id: searchSpaceId,
                custom_fields: [{
                  field_id: innFieldId,
                  value: innValue
                }]
              });
            } else {
              // Используем прямой API запрос
              const params = new URLSearchParams({
                space_id: searchSpaceId,
                'custom_fields[0][field_id]': innFieldId,
                'custom_fields[0][value]': innValue
              });
              
              foundCards = await buttonContext.request({
                method: 'GET',
                url: `/cards?${params.toString()}`
              });
            }
          } catch (e) {
            console.log('Ошибка поиска карточек:', e);
            throw new Error(`Ошибка поиска карточек: ${e.message}`);
          }
          
          console.log('Found cards:', foundCards);
          
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
            
            // Обновляем карточку
            try {
              if (buttonContext.updateCard) {
                await buttonContext.updateCard(currentCard.id, {
                  parent_id: parentCard.id
                });
              } else {
                await buttonContext.request({
                  method: 'PUT',
                  url: `/cards/${currentCard.id}`,
                  data: {
                    parent_id: parentCard.id
                  }
                });
              }
            } catch (e) {
              console.log('Ошибка обновления карточки:', e);
              throw new Error(`Ошибка установки родительской связи: ${e.message}`);
            }
            
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
          let selectedChoice;
          try {
            selectedChoice = await buttonContext.showChoice({
              title: `Найдено ${foundCards.length} карточек с ИНН ${innValue}`,
              message: 'Выберите карточку для установки как родительской:',
              choices: choices
            });
          } catch (e) {
            console.log('Ошибка показа выбора:', e);
            // Если showChoice не работает, используем showNotification для информирования
            buttonContext.showNotification({
              type: 'info',
              message: `Найдено ${foundCards.length} карточек с ИНН ${innValue}. Установите родительскую связь вручную.`
            });
            return;
          }
          
          // 10. Если пользователь выбрал карточку - устанавливаем связь
          if (selectedChoice) {
            try {
              if (buttonContext.updateCard) {
                await buttonContext.updateCard(currentCard.id, {
                  parent_id: selectedChoice.id
                });
              } else {
                await buttonContext.request({
                  method: 'PUT',
                  url: `/cards/${currentCard.id}`,
                  data: {
                    parent_id: selectedChoice.id
                  }
                });
              }
            } catch (e) {
              console.log('Ошибка обновления карточки:', e);
              throw new Error(`Ошибка установки родительской связи: ${e.message}`);
            }
            
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
