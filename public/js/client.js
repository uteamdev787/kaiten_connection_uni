Addon.initialize({
  // ВОЗВРАЩАЕМ ПУСТОЙ ОБРАБОТЧИК
  // Это говорит Kaiten: "Я знаю о существовании кнопок, но мой JS-код не добавляет никаких новых".
  // Ошибка "Handler not found" должна исчезнуть.
  'card_buttons': async (context) => {
    return []; // Обязательно вернуть пустой массив
  },

  // Этот раздел остается без изменений для показа бейджа.
  'card_facade_badges': async (context) => {
    try {
      const card = await context.getCard();
      
      if (card && card.parent_id) {
        return {
          text: '✓ Связан с договором',
          color: 'green'
        };
      }
    } catch (error) {
      console.error('Error in card_facade_badges:', error);
    }
    
    return null;
  }
});
