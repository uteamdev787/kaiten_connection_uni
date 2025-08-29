Addon.initialize({
  // 1. Создаем кнопку внутри карточки
  'card_buttons': async (cardButtonsContext) => {
    
    // Получаем ID пространства, в котором находится карточка
    const card = await cardButtonsContext.getCard();
    
    // Показываем кнопку только в пространстве счетов (id 517319)
    if (card.space.id !== 517319) {
      return [];
    }

    // Если это пространство счетов, возвращаем кнопку
    return [{
      text: '🔗 Связать с договором',
      callback: async (buttonContext) => {
        // При нажатии открываем всплывающее окно (popup)
        return buttonContext.openPopup({
          type: 'iframe',
          title: 'Связывание с договором по ИНН',
          url: './public/views/link-contract.html', // URL нашего интерфейса
          height: 200, // Высота будет авто-подстроена скриптом
          width: 500
        });
      }
    }];
  },

  // 2. Добавляем значок (бейдж) на фасад карточки
  'card_facade_badges': async (context) => {
    const card = await context.getCard();
    
    // Если у карточки есть родитель, показываем зеленый бейдж
    if (card.parent_id) {
      return {
        text: '✓ Связан с договором',
        color: 'green'
      };
    }
    // В противном случае ничего не показываем
    return null;
  }
});
