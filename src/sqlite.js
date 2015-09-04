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


        //this.query('SELECT * FROM sqlite_master', function(tx, result, error) {
        //    console.log(tx, result, error);
        //});

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
                        var rows = _.keys(res.rows.item(0)),
                            newRows = _.keys(oStructure.fields),
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
                var keys = _.keys(index),
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
        var defaultKeys = _.keys(data),
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
    //,
    //queries: function (sqls) {
    //
    //    // Query deferred
    //    var df = pub.Deferred(),
    //        queries = _.isArray(sqls) ? sqls : arguments;
    //
    //    // Create transaction for all queries
    //    this.rawTx(function (tx) {
    //        var dfSql = pub.Deferred(),
    //            sql, args, parts,
    //            i, iLen, j, jLen,
    //            succ, error = dfSql.reject;
    //
    //        // Loop through queries
    //        for(i = 0, iLen = queries.length; i < iLen; i++) {
    //            sql = queries[i];
    //            args = queries[i+1];
    //
    //            // Convert function into SQL
    //            if(typeof sql === 'function') {
    //                sql = sql.toString();
    //                sql = sql.substr(sql.indexOf('/*!')+3);
    //                sql = sql.substr(0, sql.lastIndexOf('*/'));
    //            }
    //
    //            // Add ? for fields in insert
    //            parts = /^\s*(?:INSERT|REPLACE)\s+INTO\s+\w+\s*\(([^\)]+)\)\s*$/i.exec(sql);
    //            if(parts && parts[1]) {
    //                sql += ' VALUES ('+(new Array(parts[1].split(',').length)).join('?,')+'?)';
    //            }
    //
    //            // If query has args
    //            if(_.isArray(args)) {
    //                i += 1;
    //
    //                // If args is actually array of args
    //                if(_.isArray(args[0])) {
    //                    for(j = 0, jLen = args.length; j < jLen; j++) {
    //                        if(i + 1 === iLen && j + 1 === jLen) {
    //                            succ = dfSql.resolve;
    //                        }
    //                        tx.executeSql(sql, args[j], succ, error);
    //                    }
    //                }
    //
    //                // Run query with args
    //                else {
    //                    if(i + 1 === iLen) {
    //                        succ = dfSql.resolve;
    //                    }
    //                    tx.executeSql(sql, args, succ, error);
    //                }
    //            }
    //
    //            // Just run the query
    //            else {
    //                if(i + 1 === iLen) {
    //                    succ = dfSql.resolve;
    //                }
    //                tx.executeSql(sql, [], succ, error);
    //            }
    //        }
    //
    //        // Resolve the last set of results
    //        dfSql.fail(df.reject).done(function (tx, res) {
    //            var ret = null, i, rows;
    //            if(res) {
    //                rows = res.rows;
    //                if(rows) {
    //                    ret = [];
    //                    for(i = 0; i < rows.length; i++) {
    //                        ret[i] = rows.item(i);
    //                    }
    //                }
    //                if(ret && ret.length === 0) {
    //                    try {
    //                        ret.insertId = res.insertId;
    //                    } catch(e) {
    //                        ret.insertId = null;
    //                    }
    //                }
    //                else {
    //                    ret.insertId = null;
    //                }
    //            }
    //            df.resolve(ret);
    //        });
    //    });
    //
    //    // Return a promise for queries
    //    return df.promise();
    //},
    //// Runs a transaction manually on database
    //rawTx: function (fn) {
    //    db.transaction(fn);
    //}

};

var sqlitejs = {

    _cache: {},

    openDatabase: function(config) {
        if (!this._cache[config.name]) {
            this._cache[config.name] = new Websql(config);
        }

        return this._cache[config.name];
    },

    /**
     * @type {Websql}
     */
    _db: null,

    /**
     * Инициализируем БД
     * @param config
     * @returns {Websql}
     */
    setDB: function(config){
        this._db = this.openDatabase(config);
        return this._db;
    },

    /**
     * Возвращает ранее инициализированную БД
     * @returns {Websql}
     */
    getDB: function(){
        return this._db;
    },


    fromObject: function(oSchema, oClass, oObject){

        if(oObject===null){
            return oClass;
        }
        _(oSchema.fields)
            .forOwn(function(value, key){
                oClass[key] = oObject[key];
            }
        ).value();

        oClass.id = oObject.id;
        oClass.created_at = oObject.created_at;
        oClass.updated_at = oObject.updated_at;

        return oClass;
    },

    toObject: function(oSchema, oClass){
        var lResult = {};
        _(oSchema.fields)
            .forOwn(function(value, key){
                lResult[key] = oClass[key];
            }
        ).value();
        lResult.id = oClass.id;

        return lResult;
    },

    save: function(oSchema, oClass, fCallBack){

        this.createTableIfNotExist(oSchema);

        this.getDB().save(oSchema.name,
            sqlitejs.toObject(oSchema, oClass),
            function(nId){
                oClass.id = nId;
                fCallBack();
            });
    },

    byId: function(nId, oSchema, oClass, fCallBack){

        var self = this;
        self.createTableIfNotExist(oSchema);
        self.getDB().byId(oSchema.name, nId, function(arResult){

            fCallBack(self.fromObject(oSchema, oClass, arResult));

        });

    },

    byDateAndIdUser: function(nIdUser, nDate, sDateProp, oSchema, oClass, fCallBack){

        var self = this;
        self.createTableIfNotExist(oSchema);

        var find = {
            where: [
                {field: 'id_user', op:'=', value: nIdUser},
                'and',
                {field: sDateProp, op:'=', value: nDate}
            ]
        };

        self.getDB().find(oSchema.name, find, function(arResult){
            if(arResult===null || arResult.length===0){
                fCallBack(oClass);
            }else{
                fCallBack(self.fromObject(oSchema, oClass, arResult[0]));
            }

        });

    },

    byPeriodAndIdUser: function(nIdUser, nDateStart, nDateEnd, sDateProp, oSchema, fConstructorClass, fCallBack){

        var self = this;
        self.createTableIfNotExist(oSchema);

        var find = {
            where: [
                {field: 'id_user', op:'=', value: nIdUser},
                'and',
                {field: sDateProp, op:'>=', value: nDateStart},
                'and',
                {field: sDateProp, op:'<=', value: nDateEnd}
            ],
            order: sDateProp
        };

        self.getDB().find(oSchema.name, find, function(arResult){
            if(arResult===null || arResult.length===0){
                fCallBack([]);
            }else{

                var ar = arResult.map(function(oItem){
                    var lNew = new fConstructorClass();
                    return self.fromObject(oSchema, lNew, oItem)
                });

                fCallBack(ar);
            }

        });

    },

    _createTableIfNotExistCache: {},
    createTableIfNotExist: function(oSchema, bReCreate){
        if(this._createTableIfNotExistCache[oSchema.name] === true && bReCreate!==true){
            return;
        }
        this.getDB().createTable(oSchema);
        this._createTableIfNotExistCache[oSchema.name] = true;
    }

};