Addon.initialize({
  // 1. Создаем кнопку внутри карточки
  'card_buttons': async (context) => {
    
    // ИСПОЛЬЗУЕМ ОПЦИОНАЛЬНУЮ ЦЕПОЧКУ ('?.')
    // Это гарантирует, что код не упадет с ошибкой, если context или context.space будут undefined.
    // Если id пространства не равен 517319, мы просто ничего не делаем.
    if (context?.space?.id !== 517319) {
      return []; // Не показываем кнопку
    }

    // Если проверка прошла, возвращаем кнопку
    return [{
      text: '🔗 Связать с договором',
      callback: async (buttonContext) => {
        return buttonContext.openPopup({
          type: 'iframe',
          title: 'Связывание с договором по ИНН',
          url: './public/views/link-contract.html',
          height: 200,
          width: 500
        });
      }
    }];
  },

  // 2. Добавляем значок (бейдж) на фасад карточки
  'card_facade_badges': async (context) => {
    try {
      // Оборачиваем в try...catch на случай, если и здесь возникнет похожая проблема
      const card = await context.getCard();
      
      if (card && card.parent_id) {
        return {
          text: '✓ Связан с договором',
          color: 'green'
        };
      }
    } catch (error) {
      // Если что-то пошло не так, просто ничего не показываем и логируем ошибку
      console.error('Error in card_facade_badges:', error);
    }
    
    return null; // В случае ошибки или отсутствия parent_id ничего не показываем
  }
});
