# websqljs

Написать класс реализующий работу с webSql.

Библиотека будет использоваться в cordova проекте.
Основная цель: упрощение работы с БД.

Обязательно написать тесты:
 - Тесты для построителей запросов
 - Тесты работы с БД: чтение, запись, выборки...
 - Тесты на jasmine.
 
 Разработку удобнее всего ввести в браузере (Chrome поддерживает WebSQL)
 Но обязательно нужно проверить выполнение всех тестов в Cordova: 1)http://cordova.apache.org/docs/en/5.0.0/cordova_storage_storage.md.html#Storage_websql и 2) https://github.com/litehelpers/Cordova-sqlite-storage

``` javascript



var sqlitejs = {};


/*
 Открываем БД. Т.к. openDatabase может быть много раз,
 в разных частях кода, то запомнить в кеше.
 */

var db = sqlitejs.openDatabase({
    name: 'test',
    version: '1',//Для чего?
    displayname: 'test',//Для чего?
    size: 1000000,//какой размер устанавливать? Нужно ли указывать на phonegap
    /*
    Если true, будет использоваться https://github.com/litehelpers/Cordova-sqlite-storage
    false, то websql
    Там разница только в способе открытия БД
     window.sqlitePlugin.openDatabase vs window.openDatabase
     */
    sqlitePlugin: true //true, то будет использоваться
});

/**
 * Выполнить произвольный запрос к БД -> executeSql
 */
db.query('sql запрос', function(tx, res){});

/*
 Опишем таблицу.
 */

var sport_diary = {
    name: 'sport_diary', // Наименование таблицы

    /*
     Описание полей таблицы
     name - наимеование колонки
     type - тип колонки.
     Возможны следующие варианты:
     - integer
     - real
     - text
     - date (в sqlite хранится как integer)
     - json (в sqlite хранится как text)



     Автоматически добавляются следующие колонки
     id - integer AUTO_INCREMENT - id записи
     created_at - date - дата и время добавления записи
     updated_at - date - дата и время добавлении записи
     */
    fields: [
        {name: 'id_user', type: 'integer'},
        {name: 'date_of_training', type: 'date'},
        {name: 'training', type: 'json'},
        {name: 'note', type: 'text'}
    ],
    /*
     Индексы таблицы
     */
    index: [
        /*
         fields - массив полей для индекса
         unique: true - говорит, что это уникальный индекс.
         */
        {fields: ['id_user', 'date_of_training'], unique: true}
    ]
    //createIndex: function(tableName, columns, options) {
    //    options = options || {};
    //    return "CREATE "+(options.unique?"UNIQUE ":"")+"INDEX IF NOT EXISTS `" + tableName + "__" + columns.join("_") +
    //        "` ON `" + tableName + "` (" +
    //        columns.map(function(col) { return "`" + col + "`"; }).join(", ") + ")";
    //}
};

/*
 Определяем сущность, т.е. иными словами создаем таблицу.

 Если такой таблицы не было, то она должна быть создана.
 Если появились новые поля, которых нет в таблице, то они должны быть добавлены.
 Удаляться поля не будут.
 */

db.createTable(sport_diary);



/*
 Получить все записи из заданной таблицы
 arResult - это массив объектов.
 Каждый объект соотвествует строке.

 Преобразование из sqlite в object.
 Это преобразование происходит и в других выборках.
 - integer -> number
 - real -> number
 - text -> string
 - date  -> javascript Date
 - json -> javascript Object
 */

db.all('sport_diary', function(arResult, err){

    //...

});

/**
 * Найти строку по id
 * Параметры:
 *      - наименование таблицы
 *      - id строки
 *      - callback
 */
db.byId('sport_diary', 1 , function(oResult, err){
    /*
     Если строка по id не найдена, то oResult = null
     Иначе oResult - это объект заполненный в соотвествии строкой из БД
     См.  преобразование из sqlite в object.
     */
});

db.find('sport_diary',
    {
        /*
         Условия запроса
         - field - имя колонки
         - op - способ сравнения: =, <, >, >= , <=
         - value - значчение условия
         */
        where: [
            {field: 'id_user', op:'=', value: 5},
            'and',
            {field: 'date_of_training', op:'>=', value: 5000},
            'and',
            {field: 'date_of_training', op:'<=', value: 5000},
            'or',
            {field: 'date_of_training', op:'=', value: 3333}
        ],
        /*
         Сортировка
         */
        order: "date_of_training desc, id_user asc"
    } , function(arResult, err){
        /*
         arResult - массив выбоки. Если ничего не найдено, то массив пустой.
         См.  преобразование из sqlite в object.
         */
    });



/*
 Вставляем запись в заданную таблицу. Аналогично insert в sql
 Поля created_at, updated_at автоматически заполнятся текущим временем.
 Преобразование из object в sqlite .

 - javascript Date  -> integer
 - javascript Object-> json строка

 */
db.insert('sport_diary',
    {
        id_user: 3,
        date_of_training: new Date(),
        training: {some_object: [1,2]},
        note: 'note'
    }
    , function(newId, err){

        /*
         newId - id вставленой записи
         */

    });

/*
 Обнолвяем запись в заданной таблице. Аналогично update
 Поле  updated_at автоматически заполнится текущим временем.
 */
db.update('sport_diary',
    {
        id: 3,
        id_user: 3,
        date_of_training: new Date(),
        training: {some_object: [1,2, 3]},
        note: 'note'
    }
    , function(err){


    });


/*
 Если 'объект с данными' не имеет id, или id = 0,null, то будет выполнен db.insert
 Если 'объект с данными' имеет id, то производится проверка на его существование в таблице.
    Если нету, то db.insert с заданным ID
    Если есть, то db.update
 */
db.save('sport_diary',
    {
        id: 3,//id может присутсовать или отсуствовать
        id_user: 3,
        date_of_training: new Date(),
        training: {some_object: [1,2, 3]},
        note: 'note'
    }
    , function(newId, err){


    });



```
