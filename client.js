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
          
          // Функция для уведомлений
          const showMessage = (message, type = 'info') => {
            console.log(`[${type.toUpperCase()}] ${message}`);
            if (buttonContext.showSnackbar) {
              buttonContext.showSnackbar(message, type);
            } else {
              alert(`${type.toUpperCase()}: ${message}`);
            }
          };
          
          // 1. Получаем контекст
          let context;
          try {
            context = await buttonContext.getContext();
            console.log('Context:', context);
          } catch (e) {
            console.error('Ошибка получения контекста:', e);
            showMessage('Не удалось получить контекст аддона', 'error');
            return;
          }
          
          const cardId = context.card_id || buttonContext.card_id;
          console.log('Card ID:', cardId);
          
          if (!cardId) {
            showMessage('Не удалось получить ID карточки', 'error');
            return;
          }
          
          // 2. Получаем данные карточки
          let currentCard;
          try {
            currentCard = await buttonContext.getCard();
            console.log('=== ПОЛНАЯ СТРУКТУРА КАРТОЧКИ ===');
            console.log('Current card:', JSON.stringify(currentCard, null, 2));
          } catch (e) {
            console.error('Ошибка получения карточки:', e);
            showMessage('Не удалось получить данные карточки', 'error');
            return;
          }
          
          if (!currentCard) {
            showMessage('Данные карточки не получены', 'error');
            return;
          }
          
          // 3. Детальный поиск поля ИНН
          console.log('=== ПОИСК ПОЛЯ ИНН ===');
          let innValue = null;
          
          // Проверяем разные возможные места
          if (currentCard.custom_fields) {
            console.log('custom_fields:', JSON.stringify(currentCard.custom_fields, null, 2));
            const field = currentCard.custom_fields.find(f => f.id === innFieldId || f.field_id === innFieldId);
            if (field) {
              innValue = field.value;
              console.log('ИНН найден в custom_fields:', field);
            }
          }
          
          if (!innValue && currentCard.fields) {
            console.log('fields:', JSON.stringify(currentCard.fields, null, 2));
            const field = currentCard.fields.find(f => f.id === innFieldId || f.field_id === innFieldId);
            if (field) {
              innValue = field.value;
              console.log('ИНН найден в fields:', field);
            }
          }
          
          if (!innValue && currentCard.properties) {
            console.log('properties:', JSON.stringify(currentCard.properties, null, 2));
            const field = currentCard.properties.find(f => f.id === innFieldId || f.field_id === innFieldId);
            if (field) {
              innValue = field.value;
              console.log('ИНН найден в properties:', field);
            }
          }
          
          // Попробуем через getCardProperties
          if (!innValue) {
            try {
              console.log('Пробуем getCardProperties...');
              const cardProps = await buttonContext.getCardProperties('customProperties');
              console.log('Card properties:', JSON.stringify(cardProps, null, 2));
              
              const innProp = cardProps.find(prop => prop.property && prop.property.id === innFieldId);
              if (innProp) {
                innValue = innProp.value;
                console.log('ИНН найден через getCardProperties:', innProp);
              }
            } catch (e) {
              console.error('Ошибка getCardProperties:', e);
            }
          }
          
          console.log('Итоговое значение ИНН:', innValue);
          
          if (!innValue) {
            showMessage(`Поле ИНН (ID: ${innFieldId}) не найдено или пустое в текущей карточке`, 'warning');
            return;
          }
          
          // 4. Определяем пространство
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
          
          // 5. Проверяем настройку пространства
          const searchSpaceId = spaceMap[currentSpaceId];
          if (!searchSpaceId) {
            showMessage(`Пространство ${currentSpaceId} не настроено для поиска связанных карточек`, 'info');
            return;
          }
          
          console.log('Search space ID:', searchSpaceId);
          
          // 6. Ищем карточки
          showMessage(`Ищем карточки с ИНН ${innValue} в пространстве ${searchSpaceId}...`, 'info');
          
          let foundCards;
          try {
            const params = new URLSearchParams({
              space_id: searchSpaceId,
              'custom_fields[0][field_id]': innFieldId,
              'custom_fields[0][value]': innValue
            });
            
            console.log('Поисковый запрос:', `/cards?${params.toString()}`);
            
            foundCards = await buttonContext.request({
              method: 'GET',
              url: `/cards?${params.toString()}`
            });
            
            console.log('Found cards:', foundCards);
          } catch (e) {
            console.error('Ошибка поиска:', e);
            showMessage(`Ошибка поиска карточек: ${e.message}`, 'error');
            return;
          }
          
          // 7. Обработка результатов
          if (!foundCards || foundCards.length === 0) {
            showMessage(`Карточки с ИНН ${innValue} не найдены в пространстве ${searchSpaceId}`, 'info');
            return;
          }
          
          console.log(`Найдено ${foundCards.length} карточек`);
          
          // 8. Фильтруем карточки (исключаем текущую)
          const validCards = foundCards.filter(card => card.id !== currentCard.id);
          
          if (validCards.length === 0) {
            showMessage('Найдена только текущая карточка. Других карточек для связывания нет', 'info');
            return;
          }
          
          // 9. Если одна карточка - сразу связываем
          if (validCards.length === 1) {
            const parentCard = validCards[0];
            console.log('Автоматическое связывание с карточкой:', parentCard);
            
            try {
              await buttonContext.request({
                method: 'PUT',
                url: `/cards/${currentCard.id}`,
                data: {
                  parent_id: parentCard.id
                }
              });
              
              showMessage(`Карточка #${parentCard.id} "${parentCard.title}" установлена как родительская`, 'success');
            } catch (e) {
              console.error('Ошибка установки связи:', e);
              showMessage(`Ошибка установки родительской связи: ${e.message}`, 'error');
            }
            return;
          }
          
          // 10. Если несколько карточек - показываем выбор
          const cardsList = validCards.map(card => `#${card.id} - ${card.title}`).join('\n');
          console.log('Карточки для выбора:', cardsList);
          
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
          
          // 11. Устанавливаем связь
          try {
            await buttonContext.request({
              method: 'PUT',
              url: `/cards/${currentCard.id}`,
              data: {
                parent_id: selectedCard.id
              }
            });
            
            showMessage(`Карточка #${selectedCard.id} "${selectedCard.title}" установлена как родительская`, 'success');
          } catch (e) {
            console.error('Ошибка установки связи:', e);
            showMessage(`Ошибка установки родительской связи: ${e.message}`, 'error');
          }
          
        } catch (error) {
          console.error('=== КРИТИЧЕСКАЯ ОШИБКА ===');
          console.error('Error:', error);
          console.error('Stack:', error.stack);
          
          const message = `Произошла критическая ошибка: ${error.message}`;
          if (buttonContext.showSnackbar) {
            buttonContext.showSnackbar(message, 'error');
          } else {
            alert(message);
          }
        }
      }
    });

    return buttons;
  }
});
