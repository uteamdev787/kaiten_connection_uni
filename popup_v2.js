// Инициализация iframe SDK
const iframe = Addon.iframe();

// --- КОНФИГУРАЦИЯ ---
const spaceMap = {
  517319: 517325,
  517314: 532009,
  517324: 532011
};
const innFieldId = 415447;
// --- КОНЕЦ КОНФИГУРАЦИИ ---

// Получаем элементы DOM
const innInput = document.getElementById('innInput');
const loader = document.getElementById('loader');
const resultsBlock = document.getElementById('results');
const noResultsBlock = document.getElementById('noResults');
const choicesContainer = document.getElementById('choices');
const setParentButton = document.getElementById('setParentButton');
const cancelButton = document.getElementById('cancelButton');
const contentDiv = document.getElementById('content');

let currentCard = null;

// Функция для поиска и отображения карточек
async function findAndRenderCards(inn, searchSpaceId) {
  try {
    const foundCards = await iframe.cards.find({
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
      label.innerHTML = `<input type="radio" name="parentCard" value="${card.id}" id="${radioId}"> #${card.id} - ${card.title}`;
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
    // ===== ИЗМЕНЕНИЕ ЗДЕСЬ: Используем getAllData() =====
    const allData = await iframe.getAllData();
    currentCard = allData.card;
    const currentSpaceId = allData.space.id;
    // ===================================================
    
    const cardProps = await iframe.getCardProperties('customProperties');
    
    const innField = cardProps.find(prop => prop.property.id === innFieldId);
    const innValue = innField ? innField.value : null;

    if (!innValue) {
      iframe.showSnackbar('Поле ИНН в текущей карточке не заполнено.', 'warning');
      setParentButton.disabled = true;
      return;
    }
    
    innInput.value = innValue;
    
    const searchSpaceId = spaceMap[currentSpaceId];

    if (!searchSpaceId) {
      iframe.showSnackbar('Это пространство не настроено для поиска. Связь с договором невозможна.', 'info');
      setParentButton.disabled = true;
      return;
    }

    loader.style.display = 'block';
    iframe.fitSize(contentDiv);
    
    findAndRenderCards(innValue, searchSpaceId);

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
    await iframe.cards.update(currentCard.id, { parent_id: parentCardId });
    
    iframe.showSnackbar('Связь с договором (родительская карточка) успешно установлена!', 'success');
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
