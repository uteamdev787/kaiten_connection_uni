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
          console.log('=== НАЧАЛО РАБОТЫ АДДОНА ===');
          
          // Функция для уведомлений
          const showMessage = (message, type = 'info') => {
            console.log(`[${type.toUpperCase()}] ${message}`);
            if (buttonContext.showSnackbar) {
              buttonContext.showSnackbar(message, type);
            } else {
              alert(`${type.toUpperCase()}: ${message}`);
            }
          };
          
          // 1. Получаем контекст и данные карточки
          const context = await buttonContext.getContext();
          const cardId = context.card_id;
          const currentCard = await buttonContext.getCard();
          
          console.log('Card ID:', cardId);
          console.log('Current card properties:', currentCard.properties);
          
          // 2. Получаем значение ИНН (правильный способ)
          const innKey = `id_${innFieldId}`;
          const innValue = currentCard.properties && currentCard.properties[innKey];
          
          console.log('INN key:', innKey);
          console.log('INN value:', innValue);
          
          if (!innValue) {
            showMessage(`Поле ИНН (ID: ${innFieldId}) не заполнено в текущей карточке`, 'warning');
            return;
          }
          
          // 3. Определяем пространство через board_id
          let currentSpaceId = currentCard.space?.id || currentCard.space_id;
          
          if (!currentSpaceId && currentCard.board_id) {
            console.log('Получаем space_id через board_id:', currentCard.board_id);
            try {
              const boardData = await buttonContext.request({
                method: 'GET',
                url: `/boards/${currentCard.board_id}`
              });
              currentSpaceId = boardData.space_id;
              console.log('Space ID получен через доску:', currentSpaceId);
            } catch (e) {
              console.error('Ошибка получения данных доски:', e);
              showMessage('Не удалось получить ID пространства через доску', 'error');
              return;
            }
          }
          
          console.log('Current space ID:', currentSpaceId);
          
          if (!currentSpaceId) {
            showMessage('Не удалось определить ID пространства текущей карточки', 'error');
            return;
          }
          
          // 4. Проверяем настройку пространства
          const searchSpaceId = spaceMap[currentSpaceId];
          if (!searchSpaceId) {
            showMessage(`Пространство ${currentSpaceId} не настроено для поиска связанных карточек`, 'info');
            return;
          }
          
          console.log('Search space ID:', searchSpaceId);
          
          // 5. Ищем карточки с таким же ИНН
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
          
          // 6. Обработка результатов поиска
          if (!foundCards || foundCards.length === 0) {
            showMessage(`Карточки с ИНН ${innValue} не найдены в пространстве ${searchSpaceId}`, 'info');
            return;
          }
          
          console.log(`Найдено ${foundCards.length} карточек`);
          
          // 7. Исключаем текущую карточку из результатов
          const validCards = foundCards.filter(card => card.id !== currentCard.id);
          
          if (validCards.length === 0) {
            showMessage('Найдена только текущая карточка. Других карточек для связывания нет', 'info');
            return;
          }
          
          console.log(`Доступно для связывания: ${validCards.length} карточек`);
          
          // 8. Если найдена одна карточка - сразу связываем
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
          
          // 9. Если найдено несколько карточек - показываем выбор
          const cardsList = validCards.map((card, index) => `${index + 1}. #${card.id} - ${card.title}`).join('\n');
          console.log('Карточки для выбора:', cardsList);
          
          const userChoice = prompt(
            `Найдено ${validCards.length} карточек с ИНН ${innValue}:\n\n${cardsList}\n\nВведите номер карточки (1-${validCards.length}) или ID карточки для установки как родительской, или отмените:`
          );
          
          if (!userChoice) {
            showMessage('Операция отменена', 'info');
            return;
          }
          
          let selectedCard;
          const choice = userChoice.trim();
          
          // Пробуем интерпретировать как номер в списке (1, 2, 3...)
          const choiceNumber = parseInt(choice, 10);
          if (choiceNumber >= 1 && choiceNumber <= validCards.length) {
            selectedCard = validCards[choiceNumber - 1];
          } else {
            // Пробуем интерпретировать как ID карточки
            selectedCard = validCards.find(card => card.id === choiceNumber);
          }
          
          if (!selectedCard) {
            showMessage(`Неверный выбор: "${choice}". Введите номер от 1 до ${validCards.length} или ID карточки`, 'error');
            return;
          }
          
          // 10. Устанавливаем родительскую связь
          try {
            console.log('Устанавливаем связь с карточкой:', selectedCard);
            
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
