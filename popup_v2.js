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

const statusInfo = document.getElementById('status-info');
const mainUI = document.getElementById('main-ui');
const innInput = document.getElementById('innInput');
const loader = document.getElementById('loader');
const resultsBlock = document.getElementById('results');
const noResultsBlock = document.getElementById('noResults');
const choicesContainer = document.getElementById('choices');
const setParentButton = document.getElementById('setParentButton');
const cancelButton = document.getElementById('cancelButton');
const contentDiv = document.getElementById('content');

let currentCardId = null;

function setStatus(message, isError = false) {
  console.log(message);
  statusInfo.textContent = message;
  if (isError) statusInfo.style.color = 'red';
}

iframe.render(async () => {
  try {
    // ===== ИЗМЕНЕНИЕ ЗДЕСЬ =====
    // Получаем данные, переданные из client.js, с помощью iframe.getArgs()
    setStatus('1/5: Получение аргументов (card_id, board_id)...');
    const args = await iframe.getArgs();
    if (!args || !args.card_id || !args.board_id) {
        setStatus(`Ошибка: Не удалось получить card_id и board_id из аргументов.`, true);
        return;
    }
    currentCardId = args.card_id;
    const boardId = args.board_id;
    setStatus(`2/5: ID карточки ${currentCardId}, ID доски ${boardId}. Запрос деталей доски...`);
    // ===========================

    const boardDetails = await iframe.boards.get(boardId);
    if (!boardDetails || !boardDetails.space_id) {
        setStatus(`Ошибка: Не удалось получить ID пространства из данных доски.`, true);
        return;
    }
    const currentSpaceId = boardDetails.space_id;
    setStatus(`3/5: ID пространства: ${currentSpaceId}. Запрос полей карточки...`);
    
    const cardProps = await iframe.getCardProperties('customProperties');
    const innField = cardProps.find(prop => prop.property.id === innFieldId);
    if (!innField || !innField.value) {
      setStatus(`Ошибка: Поле ИНН (ID ${innFieldId}) не найдено или пустое.`, true);
      return;
    }
    const innValue = innField.value;
    innInput.value = innValue;
    setStatus(`4/5: ИНН найден: ${innValue}.`);
    
    const searchSpaceId = spaceMap[currentSpaceId];
    if (!searchSpaceId) {
      setStatus(`Ошибка: Пространство (${currentSpaceId}) не настроено для поиска.`, true);
      return;
    }
    setStatus(`5/5: Начинаем поиск в пространстве ${searchSpaceId}...`);
    
    statusInfo.style.display = 'none';
    mainUI.style.display = 'block';
    loader.style.display = 'block';
    iframe.fitSize(contentDiv);

    const foundCards = await iframe.cards.find({
      space_id: searchSpaceId,
      custom_fields: [{ field_id: innFieldId, value: innValue }]
    });

    loader.style.display = 'none';

    if (!foundCards || foundCards.length === 0) {
      noResultsBlock.style.display = 'block';
    } else {
      choicesContainer.innerHTML = '';
      foundCards.forEach(card => {
        const radioId = `card-${card.id}`;
        const label = document.createElement('label');
        label.className = 'radio-label';
        label.innerHTML = `<input type="radio" name="parentCard" value="${card.id}" id="${radioId}"> #${card.id} - ${card.title}`;
        choicesContainer.appendChild(label);
      });
      resultsBlock.style.display = 'block';
      choicesContainer.addEventListener('change', () => setParentButton.disabled = false);
    }
    iframe.fitSize(contentDiv);

  } catch (error) {
    setStatus(`Критическая ошибка: ${error.message}`, true);
    console.error('Критическая ошибка:', error);
  }
});

setParentButton.addEventListener('click', async () => {
  const selectedRadio = document.querySelector('input[name="parentCard"]:checked');
  if (!selectedRadio) return;
  const parentCardId = parseInt(selectedRadio.value, 10);
  try {
    await iframe.cards.update(currentCardId, { parent_id: parentCardId });
    iframe.showSnackbar('Связь с договором установлена!', 'success');
    iframe.closePopup();
  } catch (error) {
     console.error('Ошибка при установке родителя:', error);
     iframe.showSnackbar('Не удалось установить родительскую карточку.', 'error');
  }
});

cancelButton.addEventListener('click', () => iframe.closePopup());```
