// Инициализация аддона
kaiten.init((api) => {

  // Карта связей: ID пространства, где вводят ИНН -> ID пространства, где нужно искать
  const spaceMap = {
    517319: 517325,
    517314: 532009,
    517324: 532011
  };

  // ID кастомного поля для ИНН
  const innFieldId = 415447;

  // Подписываемся на событие изменения поля в карточке
  kaiten.on('card.field_changed', (payload) => {
    console.log('=== СОБЫТИЕ ИЗМЕНЕНИЯ ПОЛЯ ===');
    console.log('Payload:', payload);
    
    // 1. Проверяем, что изменилось именно наше поле ИНН
    const changedFieldId = payload.field?.id || payload.property_id || payload.field_id;
    
    if (changedFieldId !== innFieldId || !payload.value) {
      return; // Если нет, ничего не делаем
    }

    const currentCard = payload.card;
    const innValue = payload.value;

    // 2. Проверяем, есть ли текущее пространство в нашей карте связей
    const currentSpaceId = currentCard.space.id;
    const searchSpaceId = spaceMap[currentSpaceId];
    
    if (!searchSpaceId) {
      return; // Если пространство не участвует в логике, выходим
    }

    // 3. Ищем карточки в целевом пространстве с таким же ИНН
    api.cards.find({
      space_id: searchSpaceId,
      custom_fields: [{
        field_id: innFieldId,
        value: innValue
      }]
    }).then(foundCards => {
      
      // Если ничего не найдено, уведомляем пользователя
      if (!foundCards || foundCards.length === 0) {
        kaiten.ui.showNotification({
          type: 'info',
          message: `Карточки с ИНН ${innValue} не найдены в пространстве ${searchSpaceId}.`
        });
        return;
      }

      // 4. Исключаем текущую карточку
      const validCards = foundCards.filter(card => card.id !== currentCard.id);
      
      if (validCards.length === 0) {
        kaiten.ui.showNotification({
          type: 'info',
          message: 'Найдена только текущая карточка.'
        });
        return;
      }

      // 5. Если найдена одна карточка - сразу связываем
      if (validCards.length === 1) {
        const parentCard = validCards[0];
        
        api.cards.update(currentCard.id, {
          parent_id: parentCard.id
        }).then(() => {
          kaiten.ui.showNotification({
            type: 'success',
            message: `Карточка #${parentCard.id} "${parentCard.title}" установлена как родительская.`
          });
        }).catch(error => {
          kaiten.ui.showNotification({
            type: 'error',
            message: 'Не удалось установить родительскую карточку.'
          });
        });
        return;
      }

      // 6. Если найдено несколько - показываем выбор
      const choices = validCards.map(card => ({
        id: card.id,
        label: `#${card.id} - ${card.title}`
      }));
      
      kaiten.ui.showChoice({
        title: `Найдено ${validCards.length} карточек с ИНН ${innValue}`,
        message: 'Выберите карточку, чтобы установить ее как родительскую:',
        choices: choices
      }).then(selectedChoice => {
        
        if (!selectedChoice) {
          return;
        }

        const parentCardId = selectedChoice.id;

        // 7. Устанавливаем родительскую связь
        api.cards.update(currentCard.id, {
          parent_id: parentCardId
        }).then(() => {
          const parentCard = validCards.find(card => card.id === parentCardId);
          kaiten.ui.showNotification({
            type: 'success',
            message: `Карточка #${parentCardId} "${parentCard.title}" установлена как родительская.`
          });
        }).catch(error => {
          kaiten.ui.showNotification({
            type: 'error',
            message: 'Не удалось установить родительскую карточку.'
          });
        });
      });
    }).catch(error => {
      kaiten.ui.showNotification({
        type: 'error',
        message: 'Произошла ошибка при поиске карточек.'
      });
    });
  });
});
