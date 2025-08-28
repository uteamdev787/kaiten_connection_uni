const iframe = Addon.iframe();

// --- КОНФИГУРАЦИЯ ---
const spaceMap = {
  517319: 517325,
  517314: 532009,
  517324: 532011
};
const innFieldId = 415447;
// --- КОНЕЦ КОНФИГУРАЦИИ ---

const innInput = document.getElementById('innInput');
const loader = document.getElementById('loader');
const resultsBlock = document.getElementById('results');
const noResultsBlock = document.getElementById('noResults');
const choicesContainer = document.getElementById('choices');
const setParentButton = document.getElementById('setParentButton');
const cancelButton = document.getElementById('cancelButton');
const contentDiv = document.getElementById('content');

let currentCard = null;

// Функция поиска карточек
async function findAndRenderCards(api, inn, searchSpaceId) {
  try {
    const foundCards = await api.cards.find({
      space_id: searchSpaceId,
      custom_fields: [{ field_id: innFieldId, value: inn }]
    });

    loader.style.display = 'none';

    if (!foundCards || foundCards.length === 0) {
      noResultsBlock.style.display = 'block';
      iframe.fitSize(contentDiv);
      return;
    }

    choicesContainer.innerHTML = '';
    foundCards.forEach(card => {
      const radioId = `card-${card.id}`;
      const label = document.createElement('label');
      label.className = 'radio-label';
      label.setAttribute('for', radioId);
      label.innerHTML = `
        <input type="radio" name="parentCard" value="${card.id}" id="${radioId}">
        #${card.id} - ${card.title}
      `;
      choicesContainer.appendChild(label);
    });

    resultsBlock.style.display = 'block';
    
    choicesContainer.addEventListener('change', () => {
        setParentButton.disabled = false;
    });

    iframe.fitSize(contentDiv);

  } catch (error) {
    console.error('Ошибка при поиске:', error);
    iframe.showSnackbar('Произошла ошибка при поиске карточек.', 'error');
    loader.style.display = 'none';
  }
}

// Главная функция, которая запускается при открытии попапа
iframe.render(async () => {
  try {
    // ===== ИЗМЕНЕНИЕ ЗДЕСЬ =====
    const api = await Addon.api(); 
    // ===========================
    
    currentCard = await iframe.getCard();
    const cardProps = await iframe.getCardProperties('customProperties');
    
    const innField = cardProps.find(prop => prop.property.id === innFieldId);
    const innValue = innField ? innField.value : null;

    if (!innValue) {
      iframe.showSnackbar('Поле ИНН в текущей карточке не заполнено.', 'warning');
      setParentButton.disabled = true;
      return;
    }
    
    innInput.value = innValue;
    
    const currentSpaceId = currentCard.space.id;
    const searchSpaceId = spaceMap[currentSpaceId];

    if (!searchSpaceId) {
      iframe.showSnackbar('Текущее пространство не настроено для поиска.', 'info');
      setParentButton.disabled = true;
      return;
    }

    loader.style.display = 'block';
    iframe.fitSize(contentDiv);
    
    findAndRenderCards(api, innValue, searchSpaceId);

  } catch (error) {
    console.error('Ошибка при инициализации:', error);
    iframe.showSnackbar('Не удалось загрузить данные из карточки.', 'error');
  }
});

// Нажатие на кнопку "Установить родителя"
setParentButton.addEventListener('click', async () => {
  const selectedRadio = document.querySelector('input[name="parentCard"]:checked');
  if (!selectedRadio) {
    iframe.showSnackbar('Сначала выберите карточку.', 'warning');
    return;
  }

  const parentCardId = parseInt(selectedRadio.value, 10);
  
  try {
    // ===== И ИЗМЕНЕНИЕ ЗДЕСЬ =====
    const api = await Addon.api();
    // =============================
    
    await api.cards.update(currentCard.id, { parent_id: parentCardId });
    
    iframe.showSnackbar('Родительская карточка успешно установлена!', 'success');
    iframe.closePopup();

  } catch (error) {
     console.error('Ошибка при установке родителя:', error);
     iframe.showSnackbar('Не удалось установить родительскую карточку.', 'error');
  }
});

// Нажатие на кнопку "Отмена"
cancelButton.addEventListener('click', () => {
  iframe.closePopup();
});
