Addon.initialize({
  // 1. Создаем кнопку внутри карточки
  'card_buttons': async (context) => {
    
    // --- ДЛЯ ОТЛАДКИ ---
    // Выводим в консоль всё, что аддон знает о текущем контексте
    console.log('[ADDON DEBUG] Context for card_buttons:', context);
    // Выводим конкретное значение ID пространства, которое мы проверяем
    console.log('[ADDON DEBUG] Checking space ID:', context?.space?.id);
    // --- КОНЕЦ ОТЛАДКИ ---

    // Используем опциональную цепочку ('?.')
    if (context?.space?.id !== 517319) {
      // --- ДЛЯ ОТЛАДКИ ---
      console.log('[ADDON DEBUG] Condition is TRUE. Button will NOT be shown.');
      return []; // Не показываем кнопку
    }

    // --- ДЛЯ ОТЛАДКИ ---
    console.log('[ADDON DEBUG] Condition is FALSE. Button WILL be shown.');
    // Если проверка прошла, возвращаем кнопку
    return [{
      text: '🔗 Связать с договором',
      callback: async (buttonContext) => {
        return buttonContext.openPopup({
          type: 'iframe',
          title: 'Связывание с договором по ИНН',
          url: './public/views/link-contract.html',
          height: 200,
          width: 500
        });
      }
    }];
  },

  // 2. Добавляем значок (бейдж) на фасад карточки
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
