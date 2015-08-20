function isString(val) {
  return typeof(val)==='string';
}

function isNumber(val) {
  return typeof(val)==='number';
}

function isFunction(val) {
  return typeof(val)==='function';
}

function isArray(val) {
  return Array.isArray(val);
}

function isObject(val) {
  return typeof(val)==='object';
}

function tryJSON(val) {
  var json;

  try {
    json = JSON.parse(val);
  } catch(e) {
    json = val;
  }
  return json;
}

function tryDate(val) {
  var date;
  date = new Date(val);

  if (date.getYear()===70 && date.getMonth()===0 && date.getDate()===1) {
    date = val;
  }

  return date;
}

var Websql = function(config) {
  if (config.sqlitePlugin) {
    this._db = sqlitePlugin.openDatabase(config.name, config.version, config.displayname, config.size);
  } else {
    this._db = openDatabase(config.name, config.version, config.displayname, config.size);
  }
  this.debug = config.debug || false;
};

Websql.prototype = {

  _cellData: function(val) {
    if (!val) return;
    if (isObject(val)) {
      if (val instanceof(Date)) {
        val = val.getTime();
      } else {
        val = JSON.stringify(val);
      }
    }

    if (isString(val)) val = "'"+val+"'";
    return val;
  },

  _convertRows: function(result) {
    var rows = [];
    if (result && result.rows.length!==0) {
      for(var i = 0; i < result.rows.length; i++) {
        var item = result.rows.item(i);

        for (var key in item) {
          if (item.hasOwnProperty(key)) {
            if (isString(item[key])) {
              item[key] = tryJSON(item[key]);
            } else if (isNumber(item[key])) {
              item[key] = tryDate(item[key]);
            }
          }
        }

        rows.push(item);
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
        if (isFunction(callback)) callback(tx, result);
      }, function(tx, error) {
        if (isFunction(callback)) callback(tx, null, error);
      });
    });
  },

  createTable: function(struct) {
    var self = this,
        query = 'CREATE TABLE '+struct.name+' (',
        fields = ['id INTEGER PRIMARY KEY AUTOINCREMENT', 'created_at REAL', 'updated_at REAL'];

    for (var field in struct.fields) {
      if (struct.fields.hasOwnProperty(field)) {
        var type = struct.fields[field];
        if (type==='json') type = 'text';
        else if (type==='date') type = 'real';
        fields.push(field+' '+type.toUpperCase());
      }
    }

    query += (fields.join(', ')) + ')';
    
    this.query(query, function(tx, result) {
      struct.index.map(function(index) {
        var keys = Object.keys(index),
            indexes = [],
            q = index.fields.join('')+' ON '+struct.name+' ('+index.fields.join(', ')+')';
        keys.map(function(key) {
          if (key!=='fields')
            indexes.push(key);
        });
        q = 'CREATE '+indexes.join(' ').toUpperCase()+' INDEX '+q;
        self.query(q);
      });
    });

    return query;
  },

  all: function(table, callback) {
    var self = this,
        query = 'SELECT * FROM '+table;
    this.query(query, function(tx, result) {
      var rows = self._convertRows(result);
      if (isFunction(callback)) callback(rows);
    });

    return query;
  },

  byId: function(table, id, callback) {
    var query = 'SELECT * FROM '+table+' WHERE id='+id,
        self = this;
    this.query(query, function(tx, res, error) {
      var result = self._convertRows(res);
      result = result ? result[0] : null;
      if (isFunction(callback)) callback(result, error);
    });

    return query;
  },

  find: function(table, cond, callback) {
    var query = 'SELECT * FROM '+table,
        self = this;
    if (cond.where) {
      query += ' WHERE';
      cond.where.map(function(where) {
        if (isObject(where)) {
          var value = isString(where.value) ? "'"+where.value+"'" : where.value;
          query += ' '+where.field + where.op + value;
        } else {
          query += ' '+where;
        }
      });
    }

    if (cond.order) {
      query += ' ORDER BY '+cond.order;
    }

    this.query(query, function(tx, res, error) {
      var result = self._convertRows(res);
      if (isFunction(callback)) callback(result, error);
    });

    return query;
  },

  insert: function(table, data, callback) {
    //if (!isArray(data)) data = [data];
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
      vals.push(self._cellData(data[key]));
    });

    var query = 'INSERT INTO '+table+' ('+keys.join(', ')+') VALUES ('+vals.join(', ')+')';
    this.query(query, function(tx, res, error) {
      var id = res ? res.insertId : null;
      if (isFunction(callback)) callback(id, error);
    });

    return query;
  },

  update: function(table, data, callback) {
    if (!data.id) return;
    var self = this,
        set = ['updated_at='+(new Date().getTime())],
        where = '';

    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        if (key==='id') {
          where = 'id='+data[key];
        } else {
          set.push(key+'='+self._cellData(data[key]));
        }
      }
    }

    var query = 'UPDATE '+table+' SET '+set.join(', ')+' WHERE '+where;
    this.query(query, function(tx, res, error) {
      if (isFunction(callback)) callback(error);
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
            if (isFunction(callback)) callback(id, error);
          });
        } else {
          return self.update(table, data, function(error) {
            if (isFunction(callback))
              if (error) callback(null, error); else callback(id);
          });
        }
      });
    } else {
      return self.insert(table, data, function(id, error) {
        if (isFunction(callback)) callback(id, error);
      });
    }
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