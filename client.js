Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    buttons.push({
      text: '🔗 Связать по ИНН',
      callback: async (buttonContext) => {
        // ===== ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ =====
        // Формируем URL с параметрами
        const cardId = buttonContext.card_id;
        const boardId = buttonContext.board_id;
        const popupUrl = `./popup_v2.html?card_id=${cardId}&board_id=${boardId}`;

        return buttonContext.openPopup({
          type: 'iframe',
          title: 'Поиск и установка родительской карточки',
          url: popupUrl, // Используем новый URL
          height: 250,
          width: 600
        });
        // ===================================
      }
    });

    return buttons;
  }
});
