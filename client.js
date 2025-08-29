Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    buttons.push({
      text: '🔗 Связать по ИНН',
      callback: async (buttonContext) => {
        try {
          // Получаем контекст и данные карточки
          const context = await buttonContext.getContext();
          const currentCard = await buttonContext.getCard();
          
          // Получаем значение ИНН из properties
          const innFieldId = 415447;
          const innKey = `id_${innFieldId}`;
          const innValue = currentCard.properties && currentCard.properties[innKey];
          
          if (!innValue) {
            buttonContext.showSnackbar('Поле ИНН не заполнено в текущей карточке', 'warning');
            return;
          }

          // Запускаем логику поиска и связывания через глобальную функцию
          if (window.kaitenConnectByINN && window.kaitenConnectByINN.searchCards) {
            // Вызываем поиск с показом UI
            await window.kaitenConnectByINN.searchCards(currentCard, innValue, true);
          } else {
            // Fallback: показываем popup с интерфейсом поиска
            return buttonContext.openPopup({
              type: 'iframe',
              title: 'Поиск и связывание карточек по ИНН',
              url: './search-results.html',
              height: 400,
              width: 700,
              args: {
                currentCard: currentCard,
                innValue: innValue,
                innFieldId: innFieldId
              }
            });
          }
          
        } catch (error) {
          console.error('Ошибка в кнопке связывания:', error);
          buttonContext.showSnackbar(`Произошла ошибка: ${error.message}`, 'error');
        }
      }
    });

    return buttons;
  }
});
