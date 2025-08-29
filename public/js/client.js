Addon.initialize({
  // 1. Создаем кнопку внутри карточки
  'card_buttons': async (context) => {
    
    // ID пространства берем напрямую из контекста, который передается в функцию.
    // Это надежнее и не требует лишнего API-запроса.
    if (context.space.id !== 517319) {
      return []; // Если это не пространство счетов, не показываем кнопку
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
    // Здесь getCard() нужен, чтобы проверить наличие parent_id
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
