// --- НАСТРОЙКИ ---
// Замените на ваш домен в Kaiten (например, mycompany.kaiten.ru)
const KAITEN_DOMAIN = 'pokusaev.kaiten.ru'; 

// Замените на ваш API ключ. 
// Получить его можно в вашем профиле Kaiten: Мой профиль -> API-ключи -> Создать ключ.
// ВАЖНО: Хранить ключ прямо в коде небезопасно для публичных аддонов. 
// Для личного использования это допустимо.
const API_TOKEN = '507e44dd-373b-4945-a350-10ade92f5606'; 

// ID кастомного поля "ИНН Партнера"
const INN_FIELD_ID = 415447; 

// ID пространства, где искать карточки договоров
const CONTRACTS_SPACE_ID = 517325; 
// -----------------

document.addEventListener('DOMContentLoaded', () => {
    const innInput = document.getElementById('inn-input');
    const searchBtn = document.getElementById('search-btn');
    const resultsContainer = document.getElementById('results-container');
    const loader = document.getElementById('loader');

    let currentCardId = null;

    // 1. Инициализация аддона и получение данных текущей карточки
    Kaiten.init(() => {
        Kaiten.getCardProperties(['custom_fields'])
            .then(props => {
                if (props && props.custom_fields) {
                    const innField = props.custom_fields.find(field => field.id === INN_FIELD_ID);
                    if (innField && innField.value) {
                        innInput.value = innField.value;
                    } else {
                        showError("В этой карточке не заполнено поле 'ИНН Партнера'.");
                    }
                }
            });

        Kaiten.getContext().then(context => {
            currentCardId = context.card.id;
        });

        // Автоматически подгоняем размер окна аддона
        Kaiten.ui.fitSize();
    });
    
    // 2. Обработчик нажатия на кнопку "Найти договор"
    searchBtn.addEventListener('click', () => {
        const innValue = innInput.value;
        if (!innValue) {
            showError("Поле ИНН не заполнено.");
            return;
        }
        findContractCards(innValue);
    });

    // Функция поиска карточек договоров по ИНН
    async function findContractCards(inn) {
        resultsContainer.innerHTML = '';
        loader.style.display = 'block';
        Kaiten.ui.fitSize();

        const searchUrl = `https://${KAITEN_DOMAIN}/api/v1/cards?space_ids[]=${CONTRACTS_SPACE_ID}&custom_fields[]=${INN_FIELD_ID}:${inn}`;
        
        try {
            const response = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка API: ${response.statusText}`);
            }

            const cards = await response.json();
            renderResults(cards);

        } catch (error) {
            showError(`Не удалось выполнить поиск: ${error.message}`);
        } finally {
            loader.style.display = 'none';
            Kaiten.ui.fitSize();
        }
    }

    // Функция для отображения результатов поиска
    function renderResults(cards) {
        if (cards.length === 0) {
            resultsContainer.innerHTML = '<p>Договоры с таким ИНН не найдены.</p>';
            return;
        }

        cards.forEach(card => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `<p>${card.title}</p><span>ID: ${card.id}</span>`;
            item.addEventListener('click', () => linkCard(card.id));
            resultsContainer.appendChild(item);
        });
        Kaiten.ui.fitSize();
    }

    // 3. Функция для установки родительской связи
    async function linkCard(parentCardId) {
        if (!currentCardId) {
            showError("Не удалось определить ID текущей карточки.");
            return;
        }

        const updateUrl = `https://${KAITEN_DOMAIN}/api/v1/cards/${currentCardId}/`;

        try {
            const response = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ parent_id: parentCardId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Ошибка API: ${response.statusText}`);
            }

            Kaiten.ui.showSnackbar({
                message: 'Связь с договором успешно установлена!',
                type: 'success'
            });
            
            // Закрываем аддон после успешной связки
            setTimeout(() => Kaiten.closePopup(), 1500);

        } catch (error) {
            showError(`Не удалось установить связь: ${error.message}`);
        }
    }

    // Вспомогательная функция для отображения ошибок
    function showError(message) {
        Kaiten.ui.showSnackbar({ message, type: 'error' });
    }
});
