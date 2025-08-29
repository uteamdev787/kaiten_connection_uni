Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    buttons.push({
      text: '🔗 Связать по ИНН',
      callback: async (buttonContext) => {
        // Только показываем инструкцию
        if (buttonContext.showSnackbar) {
          buttonContext.showSnackbar('Измените поле ИНН в карточке, чтобы автоматически найти связанные карточки', 'info');
        } else {
          alert('Измените поле ИНН в карточке, чтобы автоматически найти связанные карточки');
        }
      }
    });

    return buttons;
  }
});
