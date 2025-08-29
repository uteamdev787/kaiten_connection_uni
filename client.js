// Добавление кнопки связывания в интерфейс карточки
Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    // Кнопка для поиска и связывания с договором
    buttons.push({
      text: '🔗 Найти договор по ИНН',
      callback: async (buttonContext) => {
        try {
          console.log('🔘 Нажата кнопка поиска договора');
          
          // Получаем данные текущей карточки
          const currentCard = await buttonContext.getCard();
          
          // ID поля с ИНН
          const INN_FIELD_ID = 415447;
          const innKey = `id_${INN_FIELD_ID}`;
          
          // Получаем значение ИНН
          let innValue = null;
          if (currentCard.properties && currentCard.properties[innKey]) {
            innValue = currentCard.properties[innKey].toString().trim();
          }
          
          // Проверяем наличие ИНН
          if (!innValue) {
            buttonContext.showSnackbar(
              '❌ Заполните поле ИНН перед поиском договора', 
              'warning'
            );
            return;
          }

          console.log('🔍 ИНН для поиска:', innValue);
          
          // Вызываем функцию поиска и связывания
          if (window.invoiceContractLinker) {
            await window.invoiceContractLinker.findAndLink(currentCard, innValue);
          } else {
            console.error('❌ Модуль связывания не загружен');
            buttonContext.showSnackbar(
              'Ошибка: система связывания не готова. Перезагрузите страницу.', 
              'error'
            );
          }

        } catch (error) {
          console.error('❌ Ошибка в кнопке поиска:', error);
          buttonContext.showSnackbar(
            'Произошла ошибка при поиске договора', 
            'error'
          );
        }
      }
    });

    return buttons;
  }
});
