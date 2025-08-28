Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    buttons.push({
      text: '🔗 Связать по ИНН',
      callback: async (buttonContext) => {
        // ===== ИЗМЕНЕНИЕ ЗДЕСЬ =====
        // Мы получаем ID карточки и доски из контекста кнопки
        // и передаем их в попап через параметр 'args'
        return buttonContext.openPopup({
          type: 'iframe',
          title: 'Поиск и установка родительской карточки',
          url: './popup_v2.html',
          height: 250,
          width: 600,
          args: {
            card_id: buttonContext.card_id,
            board_id: buttonContext.board_id
          }
        });
        // ===========================
      }
    });

    return buttons;
  }
});
