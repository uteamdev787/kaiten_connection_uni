Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    buttons.push({
      text: '🔗 Связать по ИНН',
      callback: async (buttonContext) => {
        // Открываем всплывающее окно (попап)
        return buttonContext.openPopup({
          type: 'iframe',
          title: 'Поиск и установка родительской карточки',
          // ===== ИЗМЕНЕНИЕ ЗДЕСЬ =====
          url: './popup_v2.html', 
          // ===========================
          height: 250,
          width: 600
        });
      }
    });

    return buttons;
  }
});
