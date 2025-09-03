const iframe = Addon.iframe();

// Конфигурация маппингов
const spaceMap = {
  517319: 517325, // Счета -> Договоры
  517314: 532009, // Счета -> Договоры  
  517324: 532011  // Счета -> Договоры
};

const boardMap = {
  1183281: 1183294, // Счета -> Договоры
  1183290: 1215408, // Счета -> Договоры  
  1183292: 1215428  // Счета -> Договоры
};

const innFieldId = 415447;

// DOM элементы
const innBadge = document.getElementById('innBadge');
const loadingState = document.getElementById('loadingState');
const resultsState = document.getElementById('resultsState');
const noResultsState = document.getElementById('noResultsState');
const contractsList = document.getElementById('contractsList');
const linkBtn = document.getElementById('linkBtn');
const cancelBtn = document.getElementById('cancelBtn');
const searchInterface = document.getElementById('searchInterface');

// Глобальное состояние
let currentCard = null;
let innValue = null;
let targetInfo = null;
let manualContractId = null;

// Функция создания интерфейса ручного ввода
function createManualInterface() {
  // Скрываем загрузку
  loadingState.style.display = 'none';
  
  // Показываем интерфейс ручного поиска
  resultsState.style.display = 'block';
  
  const targetDisplay = targetInfo.method === 'board' ? 
    `доске ${targetInfo.targetId}` : 
    `пространстве ${targetInfo.targetId}`;
  
  contractsList.innerHTML = `
    <div style="background: var(--addon-background-level2); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 16px 0; color: var(--addon-text-primary-color); text-align: center;">
        🔍 Ручной поиск договоров
      </h3>
      
      <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--addon-primary-color);">
        <div style="font-weight: 600; margin-bottom: 8px;">📋 Инструкция по поиску:</div>
        <ol style="margin: 0; padding-left: 20px; line-height: 1.6;">
          <li>Откройте <strong>Kaiten</strong> в новой вкладке</li>
          <li>Перейдите на ${targetDisplay}</li>
          <li>Найдите карточки с <strong>ИНН: ${innValue}</strong></li>
          <li>Скопируйте ID нужного договора (число после #)</li>
          <li>Вставьте ID в поле ниже и нажмите "Привязать"</li>
        </ol>
      </div>
      
      <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">🎯 Что искать:</div>
        <div style="font-family: monospace; background: white; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
          ИНН: <strong>${innValue}</strong>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-weight: 600; margin-bottom: 8px;">
          ID договора для привязки:
        </label>
        <input 
          type="number" 
          id="contractIdInput" 
          placeholder="Например: 12345678"
          style="width: 100%; padding: 12px; border: 2px solid var(--addon-divider); border-radius: 8px; font-size: 16px;"
        >
        <div style="font-size: 12px; color: var(--addon-text-secondary-color); margin-top: 4px;">
          Введите ID договора (только цифры)
        </div>
      </div>
      
      <div style="display: flex; gap: 12px; align-items: center;">
        <button 
          id="openTargetBtn" 
          style="flex: 1; background: var(--addon-primary-color); color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 600;"
        >
          🔗 Открыть ${targetDisplay}
        </button>
        
        <button 
          id="validateBtn" 
          style="background: #10b981; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;"
        >
          ✓ Проверить
        </button>
      </div>
    </div>
  `;
  
  // Добавляем обработчики
  setupManualHandlers();
}

// Настройка обработчиков ручного интерфейса
function setupManualHandlers() {
  const contractIdInput = document.getElementById('contractIdInput');
  const openTargetBtn = document.getElementById('openTargetBtn');
  const validateBtn = document.getElementById('validateBtn');
  
  // Валидация ввода
  contractIdInput.addEventListener('input', () => {
    const value = contractIdInput.value.trim();
    manualContractId = value ? parseInt(value) : null;
    linkBtn.disabled = !manualContractId || manualContractId <= 0;
    
    if (manualContractId > 0) {
      linkBtn.textContent = `Привязать к договору #${manualContractId}`;
    } else {
      linkBtn.textContent = 'Введите ID договора';
    }
  });
  
  // Enter в поле ввода
  contractIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && manualContractId > 0) {
      linkToContract();
    }
  });
  
  // Открытие целевой доски/пространства
  openTargetBtn.addEventListener('click', () => {
    const baseUrl = 'https://pokusaev.kaiten.ru';
    let targetUrl;
    
    if (targetInfo.method === 'board') {
      targetUrl = `${baseUrl}/board/${targetInfo.targetId}`;
    } else {
      targetUrl = `${baseUrl}/space/${targetInfo.targetId}/board`;
    }
    
    window.open(targetUrl, '_blank');
    iframe.showSnackbar(`Открыта ${targetInfo.method === 'board' ? 'доска' : 'пространство'} для поиска`, 'info');
  });
  
  // Кнопка проверки договора
  validateBtn.addEventListener('click', async () => {
    const contractId = contractIdInput.value.trim();
    
    if (!contractId || isNaN(contractId)) {
      iframe.showSnackbar('Введите корректный ID договора', 'error');
      return;
    }
    
    validateBtn.disabled = true;
    validateBtn.textContent = 'Проверяем...';
    
    try {
      // Пытаемся получить информацию о карточке
      const contractData = await iframe.requestWithContext({
        method: 'GET',
        url: `/cards/${contractId}`
      });
      
      const contractINN = contractData.properties && contractData.properties[`id_${innFieldId}`];
      
      if (contractINN && contractINN.toString().trim() === innValue) {
        iframe.showSnackbar(`Договор #${contractId} найден и подходит!`, 'success');
        contractIdInput.style.borderColor = '#10b981';
        linkBtn.disabled = false;
      } else {
        iframe.showSnackbar(`Договор найден, но ИНН не совпадает (${contractINN || 'отсутствует'})`, 'warning');
        contractIdInput.style.borderColor = '#f59e0b';
      }
      
    } catch (error) {
      console.error('Ошибка проверки договора:', error);
      iframe.showSnackbar('Договор не найден или нет доступа', 'error');
      contractIdInput.style.borderColor = '#ef4444';
    }
    
    validateBtn.disabled = false;
    validateBtn.textContent = '✓ Проверить';
  });
}

// Функция связывания счета с договором
async function linkToContract() {
  const contractId = manualContractId || parseInt(document.getElementById('contractIdInput').value);
  
  if (!contractId || contractId <= 0) {
    iframe.showSnackbar('Введите корректный ID договора', 'warning');
    return;
  }

  try {
    linkBtn.disabled = true;
    linkBtn.textContent = 'Привязываем...';
    
    console.log(`Связывание: договор #${contractId} <- счет #${currentCard.id}`);
    
    let linkSuccess = false;
    let contractTitle = `#${contractId}`;
    
    // Способ 1: Добавление как дочерняя карточка
    try {
      await iframe.requestWithContext({
        method: 'POST',
        url: `/cards/${contractId}/children`,
        data: {
          card_id: currentCard.id
        }
      });
      
      linkSuccess = true;
      console.log('Связывание через children API успешно');
      
    } catch (childError) {
      console.log('Children API не сработал, пробуем parent_id');
      
      // Способ 2: Установка parent_id
      await iframe.requestWithContext({
        method: 'PUT',
        url: `/cards/${currentCard.id}`,
        data: {
          parent_id: contractId
        }
      });
      
      linkSuccess = true;
      console.log('Связывание через parent_id успешно');
    }
    
    if (linkSuccess) {
      iframe.showSnackbar(`Счет успешно привязан к договору ${contractTitle}!`, 'success');
      
      // Закрываем popup через небольшую задержку
      setTimeout(() => {
        iframe.closePopup();
      }, 1500);
    }
    
  } catch (error) {
    console.error('Все способы связывания не сработали:', error);
    
    // Показываем инструкцию для ручного связывания
    let errorMessage = 'Автоматическое связывание не удалось. ';
    
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 403:
          errorMessage += 'Недостаточно прав.';
          break;
        case 404:
          errorMessage += 'Договор не найден.';
          break;
        default:
          errorMessage += `Ошибка ${status}.`;
      }
    }
    
    // Показываем инструкцию для ручного связывания
    const manualInstructions = `
ИНСТРУКЦИЯ РУЧНОГО СВЯЗЫВАНИЯ:

1. Откройте карточку счета #${currentCard.id}
2. Найдите поле "Родительская карточка" или "Parent Card"  
3. Введите ID: ${contractId}
4. Сохраните изменения

Прямая ссылка для редактирования:
https://pokusaev.kaiten.ru/card/${currentCard.id}
    `.trim();
    
    // Копируем инструкции в буфер обмена
    if (navigator.clipboard) {
      navigator.clipboard.writeText(manualInstructions).then(() => {
        iframe.showSnackbar(`${errorMessage} Инструкции скопированы в буфер.`, 'info');
      }).catch(() => {
        iframe.showSnackbar(errorMessage, 'error');
      });
    } else {
      iframe.showSnackbar(errorMessage, 'error');
    }
    
    // Восстанавливаем кнопку
    linkBtn.disabled = false;
    linkBtn.textContent = 'Привязать к договору';
  }
}

// Функция определения конфигурации поиска
function determineSearchConfig(card) {
  console.log('Определение конфигурации поиска');
  console.log('Board ID:', card.board_id);
  console.log('Space ID:', card.space_id);
  
  // Проверяем маппинг через board_id (основной способ)
  if (card.board_id && boardMap[card.board_id]) {
    return {
      method: 'board',
      currentId: card.board_id,
      targetId: boardMap[card.board_id]
    };
  }
  
  // Проверяем маппинг через space_id
  if (card.space_id && spaceMap[card.space_id]) {
    return {
      method: 'space',
      currentId: card.space_id,
      targetId: spaceMap[card.space_id]
    };
  }
  
  throw new Error(`Маппинг не найден!\nBoard ID: ${card.board_id}\nSpace ID: ${card.space_id}\n\nДоступные доски: ${Object.keys(boardMap).join(', ')}\nДоступные пространства: ${Object.keys(spaceMap).join(', ')}`);
}

// Обработчики событий
cancelBtn.addEventListener('click', () => {
  iframe.closePopup();
});

linkBtn.addEventListener('click', linkToContract);

// Инициализация при загрузке popup
iframe.render(async () => {
  try {
    console.log('=== ИНИЦИАЛИЗАЦИЯ POPUP ===');
    
    // Получаем текущую карточку
    currentCard = await iframe.getCard();
    
    if (!currentCard) {
      throw new Error('Не удалось получить данные карточки');
    }

    console.log('Карточка:', currentCard.id);
    console.log('Board ID:', currentCard.board_id);

    // Извлекаем ИНН
    const innKey = `id_${innFieldId}`;
    innValue = currentCard.properties && currentCard.properties[innKey];
    
    if (!innValue || innValue.toString().trim().length === 0) {
      throw new Error('Поле ИНН не заполнено в карточке');
    }

    innValue = innValue.toString().trim();
    console.log('ИНН:', innValue);
    
    // Отображаем ИНН
    innBadge.textContent = `ИНН: ${innValue}`;
    
    // Определяем конфигурацию
    targetInfo = determineSearchConfig(currentCard);
    console.log('Конфигурация:', targetInfo);
    
    // Создаем интерфейс ручного поиска
    // (поскольку API поиск не работает в iframe контексте)
    createManualInterface();
    
    iframe.fitSize(searchInterface);
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    
    loadingState.style.display = 'none';
    noResultsState.style.display = 'block';
    
    noResultsState.innerHTML = `
      <div class="no-results-icon">⚠️</div>
      <div style="font-weight: 600; margin-bottom: 12px; color: var(--addon-error-color);">
        Ошибка настройки
      </div>
      <div style="line-height: 1.6; margin-bottom: 16px; background: #fef2f2; padding: 12px; border-radius: 6px;">
        ${error.message}
      </div>
      <div style="font-size: 12px; color: var(--addon-text-secondary-color);">
        Проверьте настройки маппинга в коде аддона
      </div>
    `;
    
    iframe.fitSize(searchInterface);
  }
});