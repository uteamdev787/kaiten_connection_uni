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
          url: './popup.html',
          height: 250, // Начальная высота, будет меняться
          width: 600
        });
      }
    });

    return buttons;
  }
});
