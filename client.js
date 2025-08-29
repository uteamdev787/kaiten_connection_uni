Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    buttons.push({
      text: '🔗 Связать по ИНН',
      callback: async (buttonContext) => {
        try {
          return buttonContext.openPopup({
            type: 'iframe',
            title: 'Поиск и связывание карточек по ИНН',
            url: './search-cards.html',
            height: 500,
            width: 700
          });
        } catch (error) {
          console.error('Ошибка открытия popup:', error);
          buttonContext.showSnackbar('Не удалось открыть интерфейс поиска', 'error');
        }
      }
    });

    return buttons;
  }
});
