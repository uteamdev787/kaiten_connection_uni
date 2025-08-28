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
    
    // 1. Проверяем, что изменилось именно наше поле ИНН
    if (payload.field.id !== innFieldId || !payload.value) {
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
          message: 'Карточки с таким ИНН не найдены в связанном пространстве.'
        });
        return;
      }

      // 4. Формируем список найденных карточек для выбора
      const choices = foundCards.map(card => ({
        id: card.id,
        label: `#${card.id} - ${card.title}`
      }));
      
      // 5. Показываем пользователю модальное окно с выбором
      kaiten.ui.showChoice({
        title: 'Найдены карточки с таким же ИНН',
        message: 'Выберите карточку, чтобы установить ее как родительскую:',
        choices: choices
      }).then(selectedChoice => {
        
        // Если пользователь ничего не выбрал (нажал "Отмена"), выходим
        if (!selectedChoice) {
          return;
        }

        const parentCardId = selectedChoice.id;

        // 6. Устанавливаем родительскую связь
        api.cards.update(currentCard.id, {
          parent_id: parentCardId
        }).then(() => {
          kaiten.ui.showNotification({
            type: 'success',
            message: `Карточка #${parentCardId} успешно установлена как родительская.`
          });
        }).catch(error => {
          console.error('Ошибка при установке родительской карточки:', error);
          kaiten.ui.showNotification({
            type: 'error',
            message: 'Не удалось установить родительскую карточку.'
          });
        });
      });
    }).catch(error => {
      console.error('Ошибка при поиске карточек:', error);
      kaiten.ui.showNotification({
        type: 'error',
        message: 'Произошла ошибка при поиске карточек.'
      });
    });
  });
});
