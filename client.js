Addon.initialize({
  'card_buttons': async (cardButtonsContext) => {
    const buttons = [];

    // Единственная кнопка для поиска и привязки к договору
    buttons.push({
      text: '📄 Привязать к договору',
      callback: async (buttonContext) => {
        try {
          // Получаем текущую карточку
          const currentCard = await buttonContext.getCard();
          
          if (!currentCard) {
            buttonContext.showSnackbar('Не удалось получить данные карточки', 'error');
            return;
          }

          // Проверяем наличие ИНН
          const innKey = `id_415447`; // ID поля ИНН
          const innValue = currentCard.properties && currentCard.properties[innKey];
          
          if (!innValue || innValue.trim().length === 0) {
            buttonContext.showSnackbar('⚠️ Сначала заполните поле ИНН в карточке', 'warning');
            return;
          }

          // Уведомляем о начале поиска
          buttonContext.showSnackbar(`🔍 Поиск договоров с ИНН ${innValue.trim()}...`, 'info');

          // Открываем интерфейс поиска договоров
          return buttonContext.openPopup({
            type: 'iframe',
            title: `🔗 Выбор договора по ИНН: ${innValue.trim()}`,
            url: './contract-search.html',
            height: 650,
            width: 850,
            args: {
              currentCard: currentCard,
              innValue: innValue.trim()
            }
          });
          
        } catch (error) {
          console.error('Ошибка открытия поиска договоров:', error);
          buttonContext.showSnackbar('Не удалось открыть поиск договоров', 'error');
        }
      }
    });

    return buttons;
  }
});