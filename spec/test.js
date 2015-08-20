var db = sqlitejs.openDatabase({
    name: 'jasmine_test',
    version: '1',
    displayname: 'jasmine_test',
    size: 1000000,
    sqlitePlugin: false,
    debug: true
  });


describe('Query tests', function() {
  it('Create table', function() {
    var test_table = {
      name: 'test_table', 
      fields: {
        'id_user': 'integer',
        'date_of_training': 'date',
        'training': 'json',
        'note': 'text'
      },
      index: [
        { fields: ['id_user', 'date_of_training'], unique: true }
      ]
    };

    expect(db.createTable(test_table)).toBe(
        'CREATE TABLE test_table (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at REAL, updated_at REAL, id_user INTEGER, date_of_training REAL, training TEXT, note TEXT)'
      );
  });

  it('Select all', function() {
    expect(db.all('test_table')).toBe('SELECT * FROM test_table');
  });

  it('Select by id', function() {
    expect(db.byId('test_table', 3)).toBe('SELECT * FROM test_table WHERE id=3');
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
    expect(db.find('test_table', find)).toBe('SELECT * FROM test_table WHERE id_user=3 and date_of_training>=5000 ORDER BY date_of_training desc, id_user asc');
  });

  it('Insert', function() {
    var insert = {
        id_user: 3,
        date_of_training: new Date(),
        training: {some_object: [1,2]},
        note: 'note'
    };
    
    expect(db.insert('test_table', insert)).toBe(
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
    expect(db.update('test_table', data)).toBe(
        'UPDATE test_table SET updated_at='+data.date_of_training.getTime()+', id_user=3, date_of_training='+data.date_of_training.getTime()+', training=\'{"some_object":[1,2,3]}\', note=\'note\' WHERE id=1'
      );
  });

  it('Save without id', function() {
    var data = {
      id_user: 3,
      date_of_training: new Date(),
      training: {some_object: [1,2,3]},
      note: 'note'
    };

    expect(db.save('test_table', data)).toBe(
        'INSERT INTO test_table (created_at, updated_at, id_user, date_of_training, training, note) VALUES ('+data.date_of_training.getTime()+', '+data.date_of_training.getTime()+', 3, '+data.date_of_training.getTime()+', \'{"some_object":[1,2,3]}\', \'note\')'
      );
  });

});