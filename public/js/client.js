Addon.initialize({
  // Раздел 'card_buttons' полностью удален. Он больше не нужен.

  // Этот раздел остается, чтобы показывать бейдж после успешного связывания.
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
