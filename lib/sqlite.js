;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['lodash'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('lodash'));
  } else {
    root.sqlitejs = factory(root.lodash);
  }
}(this, function(lodash) {
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
    this._db = window.sqlitePlugin.openDatabase(config.name, config.version, config.displayname, config.size);
  } else {
    this._db = openDatabase(config.name, config.version, config.displayname, config.size);
  }
  this.debug = config.debug || false;
};

Websql.prototype = {

  _cache: {},

  _cellData: function(val) {
    if (!val) return;
    if (_.isObject(val)) {
      if (val instanceof(Date)) {
        val = val.getTime();
      } else {
        val = JSON.stringify(val);
      }
    }

    if (_.isString(val)) val = "'"+val+"'";
    return val;
  },

  _convertRows: function(table, result) {
    var rows = [];
    if (result && result.rows.length!==0) {
      for(var i = 0; i < result.rows.length; i++) {
        var item = result.rows.item(i);

        for (var key in item) {
          if (item.hasOwnProperty(key)) {
            if (this._cache[table+'_'+key]==='json') {
              item[key] = JSON.parse(item[key]);
            } else if (this._cache[table+'_'+key]==='date') {
              item[key] = new Date(item[key]);
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
        if (_.isFunction(callback)) callback(tx, result);
      }, function(tx, error) {
        if (_.isFunction(callback)) callback(tx, null, error);
      });
    });
  },

  createTable: function(struct, callback) {
    var self = this,
        query = 'CREATE TABLE '+struct.name+' (',
        fields = ['id INTEGER PRIMARY KEY AUTOINCREMENT', 'created_at REAL', 'updated_at REAL'];

    for (var field in struct.fields) {
      if (struct.fields.hasOwnProperty(field)) {
        var type = struct.fields[field];
        this._cache[struct.name+'_'+field] = type;
        if (type==='json') type = 'text';
        else if (type==='date') type = 'real';
        fields.push(field+' '+type.toUpperCase());

      }
    }

    query += (fields.join(', ')) + ')';
    
    this.query(query, function(tx, result, error) {
      // if table already exists
      if (error && error.code===5) {
        self.query('SELECT * FROM '+struct.name+' LIMIT 1', function(tx, res, error) {
          if (!res || res.rows.length===0) return;
          var rows = Object.keys(res.rows[0]),
              newRows = Object.keys(struct.fields),
              q = 'ALTER TABLE '+struct.name+' ADD COLUMN ';

          newRows.map(function(row) {
            if (rows.indexOf(row)!==-1) return;
            self.query(q+row+' '+struct.fields[row]);
          });

        });
      }

      if (_.isFunction(callback)) callback(tx, result, error);

      struct.index.map(function(index) {
        var keys = Object.keys(index),
            indexes = [],
            q = index.fields.join('')+' ON '+struct.name+' ('+index.fields.join(', ')+')';
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

  all: function(table, callback) {
    var self = this,
        query = 'SELECT * FROM '+table;
    this.query(query, function(tx, result) {
      var rows = self._convertRows(table, result);
      if (_.isFunction(callback)) callback(rows);
    });

    return query;
  },

  byId: function(table, id, callback) {
    var query = 'SELECT * FROM '+table+' WHERE id='+id,
        self = this;
    this.query(query, function(tx, res, error) {
      var result = self._convertRows(table, res);
      result = result ? result[0] : null;
      if (_.isFunction(callback)) callback(result, error);
    });

    return query;
  },

  find: function(table, cond, callback) {
    var query = 'SELECT ',
        self = this;

    if (cond.select) {
      query += cond.select.join(', ');
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

    this.query(query, function(tx, res, error) {
      var result = [];
      if (cond.row!==true)
        result = self._convertRows(table, res);
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

  insert: function(table, data, callback) {
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
      vals.push(self._cellData(data[key]));
    });

    var query = 'INSERT INTO '+table+' ('+keys.join(', ')+') VALUES ('+vals.join(', ')+')';
    this.query(query, function(tx, res, error) {
      var id = res ? res.insertId : null;
      if (_.isFunction(callback)) callback(id, error);
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

  dropTable: function(table) {
    var query = 'DROP TABLE '+table;
    this.query(query, function(tx, res, error) {

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
return sqlitejs;
}));
