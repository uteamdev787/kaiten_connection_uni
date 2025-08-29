// --- КОНФИГУРАЦИЯ ---
const spaceMap = {
  517319: 517325,
  517314: 532009,
  517324: 532011
};
const innFieldId = 415447;
// --- КОНЕЦ КОНФИГУРАЦИИ ---

// Инициализация iframe SDK
const iframe = Addon.iframe();

// DOM элементы
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
  if (statusInfo) {
    statusInfo.textContent = message;
    statusInfo.style.color = isError ? 'red' : '';
  }
}

// Простой интерфейс для ручного ввода
function createManualInterface(innValue, spaceInfo) {
  // Очищаем контейнер
  choicesContainer.innerHTML = '';
  
  // Создаем элементы интерфейса
  const instructionDiv = document.createElement('div');
  instructionDiv.style.marginBottom = '16px';
  instructionDiv.innerHTML = `
    <p><strong>ИНН:</strong> ${innValue}</p>
    <p><strong>Инструкция:</strong></p>
    <ol style="margin: 8px 0; padding-left: 20px;">
      <li>Найдите в пространстве <strong>${spaceInfo}</strong> карточку с ИНН <strong>${innValue}</strong></li>
      <li>Скопируйте ID карточки (число после # в заголовке)</li>
      <li>Введите ID в поле ниже</li>
    </ol>
  `;
  
  const inputDiv = document.createElement('div');
  inputDiv.style.marginTop = '16px';
  inputDiv.innerHTML = `
    <label class="addon-input-label">ID родительской карточки</label>
    <input type="number" id="parentCardId" class="addon-input" placeholder="Например: 12345" style="width: 100%; margin-top: 4px;">
  `;
  
  choicesContainer.appendChild(instructionDiv);
  choicesContainer.appendChild(inputDiv);
  
  // Добавляем обработчик для включения кнопки
  const parentCardIdInput = document.getElementById('parentCardId');
  parentCardIdInput.addEventListener('input', () => {
    const value = parentCardIdInput.value.trim();
    setParentButton.disabled = !value || isNaN(value) || parseInt(value) <= 0;
  });
  
  // Показываем результаты
  if (resultsBlock) resultsBlock.style.display = 'block';
}

// Обновление карточки (единственное что работает)
async function updateCardParent(cardId, parentId) {
  try {
    // Пробуем через requestWithContext для обновления
    await iframe.requestWithContext({
      method: 'PUT',
      url: `/cards/${cardId}`,
      data: {
        parent_id: parentId
      }
    });
    return true;
  } catch (error) {
    console.error('Ошибка обновления через requestWithContext:', error);
    
    // Если не получилось, покажем пользователю инструкцию
    return false;
  }
}

iframe.render(async () => {
  try {
    setStatus('1/4: Получение контекста...');
    
    // Получаем контекст
    const context = await iframe.getContext();
    if (!context || !context.card_id) {
      throw new Error('Не удалось получить контекст карточки');
    }
    
    currentCardId = context.card_id;
    const boardId = context.board_id;
    
    setStatus('2/4: Получение ИНН...');
    
    // Получаем ИНН
    const cardProps = await iframe.getCardProperties('customProperties');
    const innField = cardProps.find(prop => 
      prop.property && prop.property.id === innFieldId
    );
    
    if (!innField || !innField.value) {
      throw new Error(`Поле ИНН (ID ${innFieldId}) не найдено или пустое`);
    }
    
    const innValue = innField.value;
    innInput.value = innValue;
    
    setStatus('3/4: Определение пространства...');
    
    // Пробуем определить пространство через board (может не сработать)
    let spaceInfo = 'неизвестном';
    let searchSpaceId = null;
    
    try {
      const boardData = await iframe.requestWithContext({
        method: 'GET',
        url: `/boards/${boardId}`
      });
      
      if (boardData && boardData.space_id && spaceMap[boardData.space_id]) {
        searchSpaceId = spaceMap[boardData.space_id];
        spaceInfo = `${searchSpaceId}`;
      }
    } catch (e) {
      console.log('Не удалось определить пространство автоматически:', e);
    }
    
    // Если не получилось определить, показываем все варианты
    if (!searchSpaceId) {
      const spaceOptions = Object.values(spaceMap).join(', ');
      spaceInfo = `одном из: ${spaceOptions}`;
    }
    
    setStatus('4/4: Готово! Найдите карточку вручную...');
    
    // Показываем интерфейс
    if (statusInfo) statusInfo.style.display = 'none';
    if (mainUI) mainUI.style.display = 'block';
    if (loader) loader.style.display = 'none';
    
    createManualInterface(innValue, spaceInfo);
    iframe.fitSize(contentDiv);

  } catch (error) {
    setStatus(`Ошибка: ${error.message}`, true);
    console.error('Ошибка инициализации:', error);
    
    // Показываем интерфейс даже при ошибке
    if (statusInfo) statusInfo.style.display = 'none';
    if (mainUI) mainUI.style.display = 'block';
    if (noResultsBlock) noResultsBlock.style.display = 'block';
    iframe.fitSize(contentDiv);
  }
});

// Обработчик кнопки "Связать с договором"
setParentButton.addEventListener('click', async () => {
  const parentCardIdInput = document.getElementById('parentCardId');
  if (!parentCardIdInput) return;
  
  const parentCardId = parseInt(parentCardIdInput.value.trim(), 10);
  if (!parentCardId || parentCardId <= 0) {
    iframe.showSnackbar('Введите корректный ID карточки', 'error');
    return;
  }
  
  try {
    setParentButton.disabled = true;
    setParentButton.textContent = 'Связывание...';
    
    const success = await updateCardParent(currentCardId, parentCardId);
    
    if (success) {
      iframe.showSnackbar('Связь с договором установлена!', 'success');
      iframe.closePopup();
    } else {
      // Показываем инструкцию для ручного обновления
      iframe.showSnackbar('Автоматическое обновление недоступно. Установите связь вручную в карточке.', 'warning');
      
      // Можно оставить popup открытым для справки
      setParentButton.textContent = 'Попробовать снова';
      setParentButton.disabled = false;
    }
    
  } catch (error) {
    console.error('Ошибка при установке родителя:', error);
    iframe.showSnackbar('Ошибка: ' + error.message, 'error');
    setParentButton.disabled = false;
    setParentButton.textContent = 'Связать с договором';
  }
});

// Обработчик кнопки "Отмена"
cancelButton.addEventListener('click', () => {
  iframe.closePopup();
});
