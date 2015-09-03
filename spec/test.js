sqlitejs.setDB({
    name: 'jasmine_test',
    version: '1',
    displayname: 'jasmine_test',
    size: 1000000,
    sqlitePlugin: false,
    debug: true
});

var db = sqlitejs.getDB();


describe('Query tests', function() {

    it('Create table', function() {
        var test_table = {
            name: 'test_table',
            fields: {
                'id_user': 'integer',
                'num': 'REAL',
                'date_of_training': 'date',
                'training': 'json',
                'note': 'text'
            },
            index: [
                { fields: ['id_user', 'date_of_training'], unique: true }
            ]
        };

        expect(db._createTableSql(test_table)).toBe(
            'CREATE TABLE test_table (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at REAL, updated_at REAL, id_user INTEGER, num REAL, date_of_training REAL, training TEXT, note TEXT)'
        );
    });




    it('Select all', function() {
        expect(db._queryAll('test_table')).toBe('SELECT * FROM test_table');
    });

    it('Select by id', function() {
        expect(db._queryById('test_table', 3)).toBe('SELECT * FROM test_table WHERE id=3');
    });

    it('Find', function() {
        var find = {
            where: [
                {field: 'id_user', op:'=', value: 3},
                'and',
                {field: 'date_of_training', op:'>=', value: 5000}
            ],
            order: "date_of_training desc, id_user asc"
        };
        expect(db._queryFind('test_table', find)).toBe('SELECT * FROM test_table WHERE id_user=3 and date_of_training>=5000 ORDER BY date_of_training desc, id_user asc');
    });

    it('Insert', function() {
        var insert = {
            id_user: 3,
            date_of_training: new Date(),
            training: {some_object: [1,2]},
            note: 'note'
        };

        expect(db._queryInsert('test_table', insert)).toBe(
            'INSERT INTO test_table (created_at, updated_at, id_user, date_of_training, training, note) VALUES ('+insert.date_of_training.getTime()+', '+insert.date_of_training.getTime()+', 3, '+insert.date_of_training.getTime()+', \'{"some_object":[1,2]}\', \'note\')'
        );
    });

    it('Update', function() {
        var data = {
            id: 1,
            id_user: 3,
            date_of_training: new Date(),
            training: {some_object: [1,2,3]},
            note: 'note'
        };
        expect(db._queryUpdate('test_table', data)).toBe(
            'UPDATE test_table SET updated_at='+data.date_of_training.getTime()+', id_user=3, date_of_training='+data.date_of_training.getTime()+', training=\'{"some_object":[1,2,3]}\', note=\'note\' WHERE id=1'
        );
    });

    //xit('Save without id', function() {
    //    var data = {
    //        id_user: 3,
    //        date_of_training: new Date(),
    //        training: {some_object: [1,2,3]},
    //        note: 'note'
    //    };
    //
    //    expect(db.save('test_table', data)).toBe(
    //        'INSERT INTO test_table (created_at, updated_at, id_user, date_of_training, training, note) VALUES ('+data.date_of_training.getTime()+', '+data.date_of_training.getTime()+', 3, '+data.date_of_training.getTime()+', \'{"some_object":[1,2,3]}\', \'note\')'
    //    );
    //});

});

describe('data tests', function() {

    db.dropTable('test');

    beforeEach(function(done) {
        done();
    }, 15000);

    afterEach(function(done) {
        done();
    }, 15000);

    var tableName = 'test';


    it('create table',function(done){

        var test_table = {
            name: tableName,
            fields: {
                'id_user': 'integer',
                'num': 'numeric',
                'date_of_training': 'date',
                'training': 'json',
                'note': 'text',
                'num0': 'numeric',
                'noteEmpty': 'text'
            },
            index: [
                { fields: ['id_user', 'date_of_training'], unique: true }
            ]
        };
        db.createTable(test_table, function(tx, result, error, command){
            expect(error).toBe(undefined);
            expect(command).toBe('created');
            done();
        });

    });

    it('table add new column - таблица еще пуста',function(done){

        var test_table = {
            name: tableName,
            fields: {
                'id_user': 'integer',
                'num': 'numeric',
                'date_of_training': 'date',
                'training': 'json',
                'note': 'text',
                'num0': 'numeric',
                'noteEmpty': 'text',
                'newColumn1': 'text'
            },
            index: [
                { fields: ['id_user', 'date_of_training'], unique: true }
            ]
        };
        db.createTable(test_table, function(tx, result, error, command){
            expect(error).toBe(undefined);
            expect(command).toBe('drop created');
            done();
        });

    });


    it("byId - вернет пустой ответ", function (done) {

        db.byId(tableName, 4, function(arResult){
            expect(arResult).toBe(null);
            done();
        });

    });


    it("find - вернет пустой ответ", function (done) {

        var find = {
            where: [
                {field: 'id_user', op:'=', value: 3}
            ]
        };

        db.find(tableName, find, function(arResult){
            expect(arResult).toBe(null);
            done();
        });
    });

    var Object1 = {
        id_user: 4,
        num: 1.22,
        training: {test: 1, arTest:[{t:1}, 1, '3'], t:'', ff: {df:1}},
        date_of_training: new Date(),
        note: "text \n text",
        num0: 0,
        noteEmpty: ''

    };
    var Object1Id = 0;

    var ObjectExpect = function(arResult){
        expect(arResult['id']).toEqual(Object1Id);
        expect(arResult['id_user']).toEqual(4);
        expect(arResult['num']).toEqual(1.22);
        expect(arResult['training']).toEqual(Object1['training']);
        expect(arResult['date_of_training']).toEqual(Object1['date_of_training']);
        expect(arResult['note']).toEqual(Object1['note']);

        expect(arResult['num0']).toEqual(0);
        expect(arResult['noteEmpty']).toEqual('');

        expect(arResult['created_at']).toBeDefined();
        expect(arResult['updated_at']).toBeDefined();
    };

    it("Добавим новую запись, id не должен быть 0", function (done) {


        db.insert(tableName, Object1, function(nNewId){
            Object1Id = nNewId;
            expect(Object1Id).toBeGreaterThan(0);
            done();
        });
    });

    it('table add new column',function(done){

        var test_table = {
            name: tableName,
            fields: {
                'id_user': 'integer',
                'num': 'numeric',
                'date_of_training': 'date',
                'training': 'json',
                'note': 'text',
                'num0': 'numeric',
                'noteEmpty': 'text',
                'newColumn1': 'text',
                'newColumn2': 'text',
                'newColumn3': 'text'
            },
            index: [
                { fields: ['id_user', 'date_of_training'], unique: true }
            ]
        };
        db.createTable(test_table, function(tx, result, error, command){
            expect(error).toBe(undefined);
            expect(command).toBe('add columns:newColumn2;newColumn3;');
            done();
        });

    });


    it("Найдем ранее добавленную запись по ID", function(done){

        db.byId(tableName, Object1Id, function(arResult){

            ObjectExpect(arResult);
            done();
        });
    });


    it("find - найдем пользователя id_user = 4", function (done) {

        var find = {
            where: [
                {field: 'id_user', op:'=', value: 4},
                'and',
                {field: 'note', op:'=', value: Object1['note']}
            ]
        };

        db.find(tableName, find, function(arResult){
            expect(arResult.length).toBe(1);
            ObjectExpect(arResult[0]);
            done();
        });
    });


    it("update - обновим последнюю запись", function (done) {

        Object1['id'] = Object1Id;
        Object1['id_user'] = 5;
        db.update(tableName, Object1, function(arResult){

            var find = {
                where: [
                    {field: 'id_user', op:'=', value: 5}
                ]
            };

            db.find(tableName, find, function(arResult){
                expect(arResult.length).toBe(1);
                arResult = arResult[0];
                expect(arResult['id']).toEqual(Object1Id);
                expect(arResult['id_user']).toEqual(5);
                expect(arResult['training']).toEqual(Object1['training']);
                expect(arResult['date_of_training']).toEqual(Object1['date_of_training']);
                expect(arResult['note']).toEqual(Object1['note']);

                expect(arResult['created_at']).toBeDefined();
                expect(arResult['updated_at']).toBeDefined();
                done();
            });


        });
    });

    it("save - обновим последнюю запись", function (done) {

        Object1['id'] = Object1Id;
        Object1['id_user'] = 6;

        //db.query('SELECT * FROM sqlite_master', function(tx, result, error) {
        //    result.rows
        //    console.log(tx, result, error);
        //});


        db.save(tableName, Object1, function(arResult){

            var find = {
                where: [
                    {field: 'id_user', op:'=', value: 6}
                ]
            };

            db.find(tableName, find, function(arResult){
                expect(arResult.length).toBe(1);
                arResult = arResult[0];
                expect(arResult['id']).toEqual(Object1Id);
                expect(arResult['id_user']).toEqual(6);
                expect(arResult['training']).toEqual(Object1['training']);
                expect(arResult['date_of_training']).toEqual(Object1['date_of_training']);
                expect(arResult['note']).toEqual(Object1['note']);

                expect(arResult['created_at']).toBeDefined();
                expect(arResult['updated_at']).toBeDefined();
                done();
            });


        });
    });





});