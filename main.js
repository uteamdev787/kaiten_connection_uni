// Инициализация аддона для связывания карточек по ИНН
kaiten.init((api) => {

  // Карта связей: ID пространства, где ищем -> ID пространства, где связываем
  const spaceMap = {
    517319: 517325, // В пространстве 517319 ищем карточки в 517325
    517314: 532009, // В пространстве 517314 ищем карточки в 532009  
    517324: 532011  // В пространстве 517324 ищем карточки в 532011
  };

  // ID кастомного поля для ИНН
  const innFieldId = 415447;

  // Глобальная переменная для хранения найденных карточек
  let lastFoundCards = [];
  let lastCurrentCard = null;

  // Функция поиска и связывания карточек
  async function findAndLinkCards(currentCard, innValue, showUI = true) {
    console.log('=== ПОИСК КАРТОЧЕК ПО ИНН ===');
    console.log('Current card:', currentCard);
    console.log('INN value:', innValue);

    // Определяем пространство для поиска
    const currentSpaceId = currentCard.space?.id || currentCard.space_id;
    const searchSpaceId = spaceMap[currentSpaceId];
    
    if (!searchSpaceId) {
      if (showUI) {
        kaiten.ui.showNotification({
          type: 'info',
          message: `Пространство ${currentSpaceId} не настроено для поиска связанных карточек.`
        });
      }
      return;
    }

    try {
      // Ищем карточки с таким же ИНН в целевом пространстве
      const foundCards = await api.cards.find({
        space_id: searchSpaceId,
        custom_fields: [{
          field_id: innFieldId,
          value: innValue
        }]
      });

      console.log('Found cards:', foundCards);

      // Исключаем текущую карточку
      const validCards = foundCards.filter(card => card.id !== currentCard.id);
      
      // Сохраняем результаты глобально
      lastFoundCards = validCards;
      lastCurrentCard = currentCard;

      if (validCards.length === 0) {
        if (showUI) {
          kaiten.ui.showNotification({
            type: 'info',
            message: `Карточки с ИНН ${innValue} не найдены в пространстве ${searchSpaceId}.`
          });
        }
        return;
      }

      if (showUI) {
        // Показываем результаты через выбор или автосвязывание
        if (validCards.length === 1) {
          // Автоматически связываем единственную карточку
          const parentCard = validCards[0];
          await linkCards(currentCard.id, parentCard.id, parentCard.title);
        } else {
          // Показываем выбор через модальное окно
          const choices = validCards.map(card => ({
            id: card.id,
            label: `#${card.id} - ${card.title}`
          }));

          const selectedChoice = await kaiten.ui.showChoice({
            title: `Найдено ${validCards.length} карточек с ИНН ${innValue}`,
            message: 'Выберите карточку для установки связи:',
            choices: choices
          });

          if (selectedChoice) {
            const parentCard = validCards.find(card => card.id === selectedChoice.id);
            await linkCards(currentCard.id, parentCard.id, parentCard.title);
          }
        }
      }

      return validCards;

    } catch (error) {
      console.error('Ошибка при поиске карточек:', error);
      if (showUI) {
        kaiten.ui.showNotification({
          type: 'error',
          message: 'Произошла ошибка при поиске карточек.'
        });
      }
    }
  }

  // Функция установки родительской связи
  async function linkCards(childId, parentId, parentTitle) {
    try {
      await api.cards.update(childId, {
        parent_id: parentId
      });

      kaiten.ui.showNotification({
        type: 'success',
        message: `Карточка #${parentId} "${parentTitle}" установлена как родительская.`
      });
    } catch (error) {
      console.error('Ошибка при установке связи:', error);
      kaiten.ui.showNotification({
        type: 'error',
        message: 'Не удалось установить родительскую связь.'
      });
    }
  }

  // Автоматическое срабатывание при изменении поля ИНН
  kaiten.on('card.field_changed', (payload) => {
    console.log('=== СОБЫТИЕ ИЗМЕНЕНИЯ ПОЛЯ ===');
    
    // Проверяем, что изменилось именно поле ИНН
    const changedFieldId = payload.field?.id || payload.property_id || payload.field_id;
    
    if (changedFieldId !== innFieldId || !payload.value) {
      return;
    }

    findAndLinkCards(payload.card, payload.value, true);
  });

  // API для вызова из кнопки
  window.kaitenConnectByINN = {
    searchCards: findAndLinkCards,
    getLastResults: () => ({ cards: lastFoundCards, currentCard: lastCurrentCard }),
    linkCard: linkCards
  };

  console.log('=== АДДОН СВЯЗЫВАНИЯ ПО ИНН ИНИЦИАЛИЗИРОВАН ===');
});
