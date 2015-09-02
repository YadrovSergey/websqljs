var Websql = function(config) {
    if (config.sqlitePlugin) {
        this._db = window.sqlitePlugin.openDatabase(config.name, config.version, config.displayname, config.size);
    } else {
        this._db = openDatabase(config.name, config.version, config.displayname, config.size);
    }
    this.debug = config.debug || false;
};

Websql.prototype = {

    _cache: {},

    _toWebSQLValue: function(val) {

        if (_.isObject(val) || _.isArray(val)) {
            if (val instanceof(Date)) {
                val = val.getTime();
            } else {
                val = JSON.stringify(val);
            }
        }

        if(_.isString(val)) {
            val = "'"+val+"'";
        }
        return val;
    },

    _fromWebSqlToJsValue: function(table, result) {
        var rows = [];
        if (result && result.rows && result.rows.length!==0) {
            for(var i = 0; i < result.rows.length; i++) {
                var item = result.rows.item(i);

                var lResult = {};

                for (var key in item) {
                    if (item.hasOwnProperty(key)) {

                        lResult[key] = item[key];
                        var lTypeOfColumn = this._cache[table+'_'+key];
                        if (lTypeOfColumn==='json') {
                            lResult[key] = JSON.parse(item[key]);
                        } else if (lTypeOfColumn==='date' || key==='created_at' || key==='updated_at') {
                            lResult[key] = new Date(item[key]);
                        }else if(lResult[key] === null || lResult[key]===undefined){
                            if (lTypeOfColumn==='text') {
                                lResult[key] = '';
                            }else if(lTypeOfColumn==='numeric' || lTypeOfColumn==='integer') {
                                lResult[key] = 0;
                            }
                        }
                    }
                }

                rows.push(lResult);
            }
            return rows;
        } else {
            return null;
        }

    },


    query: function(sql, callback) {
        var debug = this.debug;
        this._db.transaction(function(tx) {
            if (debug) console.log('qeury: '+sql);
            tx.executeSql(sql, [], function(tx, result) {
                if (_.isFunction(callback)) callback(tx, result);
            }, function(tx, error) {
                if (_.isFunction(callback)) callback(tx, null, error);
            });
        });
    },

    /**
     * Формирует запрос создания таблицы
     * @param oStructure
     * @returns {string}
     * @private
     */
    _createTableSql: function(oStructure){
        var self =this,
            query = 'CREATE TABLE '+oStructure.name+' (',
            fields = ['id INTEGER PRIMARY KEY AUTOINCREMENT', 'created_at REAL', 'updated_at REAL'];


        _.forOwn(oStructure.fields, function(sType, field){

            self._cache[oStructure.name+'_'+field] = sType;
            if (sType==='json'){
                sType = 'text';
            }else if (sType==='date') {
                sType = 'real';
            }
            fields.push(field+' '+sType.toUpperCase());

        });

        query += (fields.join(', ')) + ')';

        return query;
    },


    /**
     * Создание таблицы. Данная функция должна быть обязательно вызвана, перед работой с данной таблицей.
     *
     * @see http://www.tutorialspoint.com/sqlite/sqlite_data_types.htm
     * @param oStructure
     * @param callback
     * @returns {string}
     */
    createTable: function(oStructure, callback, bReCreate) {
        var self = this;
        var query = this._createTableSql(oStructure);

        this.query(this._createTableSql(oStructure), function(tx, result, error) {

            // if table already exists
            if (error && error.code===5) {

                self.query('SELECT * FROM '+oStructure.name+' LIMIT 1', function(tx, res, error) {
                    if (!res || res.rows.length===0 && bReCreate!==true){

                        //таблица существует, но записей не имеет - удалим и пересоздаим таблицу.
                        self.dropTable(oStructure.name, function(){

                            self.createTable(oStructure, callback, true);

                        });

                    }else{
//todo _.keys(  Object.keys(
                        var rows = Object.keys(res.rows.item(0)),
                            newRows = Object.keys(oStructure.fields),
                            q = 'ALTER TABLE '+oStructure.name+' ADD COLUMN ';

                        var arQueries = [];
                        var sColumns = '';
                        newRows.map(function(row) {
                            if (rows.indexOf(row)===-1){
                                arQueries.push(q + row + ' '+oStructure.fields[row]);
                                sColumns = sColumns +  row+';';
                            }

                        });

                        var lTotal = 0;
                        arQueries.forEach(function(sQuery){
                            self.query(sQuery, function(tx, result, error){
                                lTotal = lTotal + 1;

                                if(lTotal === arQueries.length && _.isFunction(callback)){
                                    callback(tx, result, error, 'add columns:'+sColumns);
                                }

                            });

                        });


                    }


                });
            }else{
                if (_.isFunction(callback)) callback(tx, result, error, (bReCreate!==true?'created':'drop created'));
            }



            oStructure.index.map(function(index) {
                var keys = Object.keys(index),
                    indexes = [],
                    q = index.fields.join('')+' ON '+oStructure.name+' ('+index.fields.join(', ')+')';
                keys.map(function(key) {
                    if (key!=='fields')
                        indexes.push(key);
                });
                q = 'CREATE '+indexes.join(' ').toUpperCase()+' INDEX IF NOT EXISTS '+q;
                self.query(q);
            });

        });

        return query;

    },

    _queryAll: function(table) {
        return 'SELECT * FROM '+table;
    },

    all: function(table, callback) {
        var self = this,
            query = this._queryAll(table);

        this.query(query, function(tx, result) {
            var rows = self._fromWebSqlToJsValue(table, result);
            if (_.isFunction(callback)) callback(rows);
        });

        return query;
    },

    _queryById: function(table, id) {
        return 'SELECT * FROM '+table+' WHERE id='+id;
    },

    byId: function(table, id, callback) {
        var query = this._queryById(table, id),
            self = this;
        this.query(query, function(tx, res, error) {

            var result = self._fromWebSqlToJsValue(table, res);
            result = result ? result[0] : null;
            if (_.isFunction(callback)) callback(result, error);

        });

        return query;
    },

    _queryFind: function(table, cond) {
        var query = 'SELECT ',
            self = this;

        if (cond.select) {
            if (_.isString(cond.select)) {

                query += cond.select;

            }else if( _.isArray(cond.select)){

                query += cond.select.join(', ');

            }else{
                query += '*';
            }

        } else {

            query += '*';

        }

        query += ' FROM '+table;

        if (cond.where) {
            query += ' WHERE';
            cond.where.map(function(where) {
                if (_.isObject(where)) {
                    var value = _.isString(where.value) ? "'"+where.value+"'" : where.value;
                    query += ' '+where.field + where.op + value;
                } else {
                    query += ' '+where;
                }
            });
        }

        if (cond.order) {
            query += ' ORDER BY '+cond.order;
        }

        if (cond.limit) {
            query += ' LIMIT '+cond.limit;
        }

        return query;
    },

    find: function(table, cond, callback) {
        var query = this._queryFind(table, cond),
            self = this;

        this.query(query, function(tx, res, error) {
            var result = [];
            if (cond.row!==true)
                result = self._fromWebSqlToJsValue(table, res);
            else {
                if (res && res.rows.length!==0) {
                    for(var i = 0; i < res.rows.length; i++) {
                        result.push(res.rows.item(i));
                    }
                }
            }
            if (_.isFunction(callback)) callback(result, error);
        });

        return query;
    },

    _queryInsert: function(table, data) {
        //if (!_.isArray(data)) data = [data];
        var defaultKeys = Object.keys(data),
            keys = [];

        defaultKeys.map(function(key) {
            if (data[key]) keys.push(key);
        });

        keys = ['created_at', 'updated_at'].concat(keys);

        var created = new Date().getTime(),
            vals = [ created, created ],
            self = this;

        keys.map(function(key) {
            if (!data[key]) return;
            vals.push(self._toWebSQLValue(data[key]));
        });

        return 'INSERT INTO '+table+' ('+keys.join(', ')+') VALUES ('+vals.join(', ')+')';
    },

    insert: function(table, data, callback) {

        var query = this._queryInsert(table, data);

        this.query(query, function(tx, res, error) {
            var id = res ? res.insertId : null;
            if (_.isFunction(callback)) callback(id, error);
        });

        return query;
    },

    _queryUpdate: function(table, data) {
        var self = this,
            set = ['updated_at='+(new Date().getTime())],
            where = '';

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                if (key==='id') {
                    where = 'id='+data[key];
                } else {
                    set.push(key+'='+self._toWebSQLValue(data[key]));
                }
            }
        }

        return 'UPDATE '+table+' SET '+set.join(', ')+' WHERE '+where;
    },
    update: function(table, data, callback) {
        if (!data.id) return;

        var query = this._queryUpdate(table, data);
        this.query(query, function(tx, res, error) {
            if (_.isFunction(callback)) callback(error);
        });

        return query;
    },

    save: function(table, data, callback) {
        var id = data.id || null,
            self = this;

        if (id) {
            this.byId(table, id, function(result, error) {
                if (!result) {
                    return self.insert(table, data, function(id, error) {
                        if (_.isFunction(callback)) callback(id, error, true);
                    });
                } else {
                    return self.update(table, data, function(error) {
                        if (_.isFunction(callback))
                            callback(id, error, false);
                    });
                }
            });
        } else {
            return self.insert(table, data, function(id, error) {
                if (_.isFunction(callback)) callback(id, error, true);
            });
        }
    },

    dropTable: function(table, fCallBack) {
        var query = 'DROP TABLE '+table;
        this.query(query, function(tx, res, error) {
            if(fCallBack){
                fCallBack(tx, res, error);
            }
        });
    },

    deleteById: function(table, id) {
        var query = 'DELETE FROM '+table+' WHERE id='+id;
        this.query(query, function(tx, res, error) {

        });
    }

};

var sqlitejs = {

    _cache: {},

    openDatabase: function(config) {
        if (!this._cache[config.name]) {
            this._cache[config.name] = new Websql(config);
        }

        return this._cache[config.name];
    }
};