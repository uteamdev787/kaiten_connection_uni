Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    buttons.push({
      text: '🔗 Связать по ИНН',
      callback: async (buttonContext) => {
        console.log('Button context:', buttonContext); // Отладочная информация
        
        // Простое открытие popup без параметров в URL
        // Данные будут получены через iframe.getContext()
        return buttonContext.openPopup({
          type: 'iframe',
          title: 'Поиск и установка родительской карточки',
          url: './popup_v2.html', // Убираем параметры из URL
          height: 250,
          width: 600
        });
      }
    });

    return buttons;
  }
});
