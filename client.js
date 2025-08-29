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
          console.log('=== ОТЛАДОЧНАЯ ИНФОРМАЦИЯ ===');
          console.log('Button context:', buttonContext);
          console.log('Available methods:', Object.keys(buttonContext));
          console.log('buttonContext type:', typeof buttonContext);
          
          // Поиск методов уведомлений
          const notificationMethods = Object.keys(buttonContext).filter(key => 
            key.toLowerCase().includes('notification') || 
            key.toLowerCase().includes('message') || 
            key.toLowerCase().includes('alert') ||
            key.toLowerCase().includes('show')
          );
          console.log('Notification-like methods:', notificationMethods);
          
          // Поиск API методов
          const apiMethods = Object.keys(buttonContext).filter(key => 
            key.toLowerCase().includes('api') || 
            key.toLowerCase().includes('card') || 
            key.toLowerCase().includes('request')
          );
          console.log('API-like methods:', apiMethods);
          
          // Простая функция для показа сообщений (fallback)
          const showMessage = (message, type = 'info') => {
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(`${type.toUpperCase()}: ${message}`);
          };
          
          // 1. Получаем данные текущей карточки
          let currentCard;
          try {
            console.log('Попытка получить карточку...');
            console.log('card_id:', buttonContext.card_id);
            
            if (buttonContext.getCard) {
              console.log('Использую getCard()');
              currentCard = await buttonContext.getCard();
            } else if (buttonContext.card) {
              console.log('Использую buttonContext.card');
              currentCard = buttonContext.card;
            } else if (buttonContext.request) {
              console.log('Использую request API');
              currentCard = await buttonContext.request({
                method: 'GET',
                url: `/cards/${buttonContext.card_id}`
              });
            } else {
              throw new Error('Нет доступных методов для получения карточки');
            }
          } catch (e) {
            console.error('Ошибка получения карточки:', e);
            showMessage('Не удалось получить данные текущей карточки', 'error');
            return;
          }
          
          if (!currentCard) {
            showMessage('Не удалось получить данные текущей карточки', 'error');
            return;
          }
          
          console.log('Current card:', currentCard);
          
          // 2. Получаем значение ИНН из текущей карточки
          let innField = null;
          let innValue = null;
          
          console.log('Поиск поля ИНН...');
          if (currentCard.custom_fields && Array.isArray(currentCard.custom_fields)) {
            console.log('Ищем в custom_fields:', currentCard.custom_fields);
            innField = currentCard.custom_fields.find(field => field.id === innFieldId);
          } else if (currentCard.fields && Array.isArray(currentCard.fields)) {
            console.log('Ищем в fields:', currentCard.fields);
            innField = currentCard.fields.find(field => field.id === innFieldId);
          }
          
          console.log('INN field found:', innField);
          
          if (innField) {
            innValue = innField.value;
          }
          
          if (!innValue) {
            showMessage('Поле ИНН не заполнено в текущей карточке', 'warning');
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
          
          console.log('Current space ID:', currentSpaceId);
          
          if (!currentSpaceId) {
            showMessage('Не удалось определить ID пространства текущей карточки', 'error');
            return;
          }
          
          // 4. Проверяем, настроено ли текущее пространство
          const searchSpaceId = spaceMap[currentSpaceId];
          if (!searchSpaceId) {
            showMessage(`Пространство ${currentSpaceId} не настроено для поиска связанных карточек`, 'info');
            return;
          }
          
          console.log('Search space ID:', searchSpaceId);
          
          // 5. Ищем карточки с таким же ИНН в целевом пространстве
          showMessage(`Ищем карточки с ИНН ${innValue} в пространстве ${searchSpaceId}...`, 'info');
          
          let foundCards;
          try {
            console.log('Начинаем поиск карточек...');
            
            if (buttonContext.findCards) {
              console.log('Использую findCards()');
              foundCards = await buttonContext.findCards({
                space_id: searchSpaceId,
                custom_fields: [{
                  field_id: innFieldId,
                  value: innValue
                }]
              });
            } else if (buttonContext.request) {
              console.log('Использую request API');
              const params = new URLSearchParams({
                space_id: searchSpaceId,
                'custom_fields[0][field_id]': innFieldId,
                'custom_fields[0][value]': innValue
              });
              
              foundCards = await buttonContext.request({
                method: 'GET',
                url: `/cards?${params.toString()}`
              });
            } else {
              throw new Error('Нет доступных методов для поиска карточек');
            }
          } catch (e) {
            console.error('Ошибка поиска карточек:', e);
            showMessage(`Ошибка поиска карточек: ${e.message}`, 'error');
            return;
          }
          
          console.log('Found cards:', foundCards);
          
          // 6. Обрабатываем результаты
          if (!foundCards || foundCards.length === 0) {
            showMessage(`Карточки с ИНН ${innValue} не найдены в пространстве ${searchSpaceId}`, 'info');
            return;
          }
          
          // 7. Если найдена только одна карточка - сразу связываем
          if (foundCards.length === 1) {
            const parentCard = foundCards[0];
            console.log('Found single card:', parentCard);
            
            // Проверяем, не пытаемся ли мы связать карточку саму с собой
            if (parentCard.id === currentCard.id) {
              showMessage('Нельзя связать карточку саму с собой', 'warning');
              return;
            }
            
            // Обновляем карточку
            try {
              console.log('Обновляем карточку...');
              if (buttonContext.updateCard) {
                console.log('Использую updateCard()');
                await buttonContext.updateCard(currentCard.id, {
                  parent_id: parentCard.id
                });
              } else if (buttonContext.request) {
                console.log('Использую request API для обновления');
                await buttonContext.request({
                  method: 'PUT',
                  url: `/cards/${currentCard.id}`,
                  data: {
                    parent_id: parentCard.id
                  }
                });
              } else {
                throw new Error('Нет доступных методов для обновления карточки');
              }
            } catch (e) {
              console.error('Ошибка обновления карточки:', e);
              showMessage(`Ошибка установки родительской связи: ${e.message}`, 'error');
              return;
            }
            
            showMessage(`Карточка #${parentCard.id} "${parentCard.title}" установлена как родительская`, 'success');
            return;
          }
          
          // 8. Если найдено несколько карточек - показываем список
          const validCards = foundCards.filter(card => card.id !== currentCard.id);
          
          if (validCards.length === 0) {
            showMessage('Найдена только текущая карточка. Других карточек для связывания нет', 'info');
            return;
          }
          
          console.log('Valid cards for linking:', validCards);
          
          // 9. Поскольку showChoice может не работать, покажем список в консоли и alert
          const cardsList = validCards.map(card => `#${card.id} - ${card.title}`).join('\n');
          console.log('Available cards for linking:', cardsList);
          
          const userChoice = prompt(
            `Найдено ${validCards.length} карточек с ИНН ${innValue}:\n\n${cardsList}\n\nВведите ID карточки (только цифры) для установки как родительской, или отмените:`
          );
          
          if (!userChoice) {
            showMessage('Операция отменена', 'info');
            return;
          }
          
          const selectedCardId = parseInt(userChoice.trim(), 10);
          const selectedCard = validCards.find(card => card.id === selectedCardId);
          
          if (!selectedCard) {
            showMessage(`Карточка с ID ${selectedCardId} не найдена среди доступных`, 'error');
            return;
          }
          
          // 10. Устанавливаем связь с выбранной карточкой
          try {
            console.log('Устанавливаем связь с карточкой:', selectedCard);
            if (buttonContext.updateCard) {
              await buttonContext.updateCard(currentCard.id, {
                parent_id: selectedCard.id
              });
            } else if (buttonContext.request) {
              await buttonContext.request({
                method: 'PUT',
                url: `/cards/${currentCard.id}`,
                data: {
                  parent_id: selectedCard.id
                }
              });
            }
            
            showMessage(`Карточка #${selectedCard.id} "${selectedCard.title}" установлена как родительская`, 'success');
          } catch (e) {
            console.error('Ошибка установки связи:', e);
            showMessage(`Ошибка установки родительской связи: ${e.message}`, 'error');
          }
          
        } catch (error) {
          console.error('=== КРИТИЧЕСКАЯ ОШИБКА ===');
          console.error('Error:', error);
          console.error('Stack:', error.stack);
          alert(`Произошла критическая ошибка: ${error.message}`);
        }
      }
    });

    return buttons;
  }
});
