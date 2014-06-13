/* global describe, before, beforeEach, it */

var _ = require('lodash'),
    Sequelize = require('sequelize'),
    should = require('should'),
    passportLocalSequelize = require('../lib/passport-local-sequelize');

var db = new Sequelize('test-db', 'user', 'pass', {
    dialect: 'sqlite',
    storage: 'test/test-db.sqlite',
    logging: false
});

var User;

var initDb = function (done) {
    User = passportLocalSequelize.defineUser(db, {
        token: {
            type: Sequelize.STRING,
            allowNull: true
        }
    }, {
        iterations: 1000,
        defineOptions: {
            instanceMethods: {
                generateToken: function () {
                    this.token = '1234';
                }
            },

            classMethods: {
                getByToken: function () {
                    return this.find({
                        where: {
                            token: '1234'
                        }
                    });
                }
            }
        }
    });

    // Authenticate the db
    db.authenticate()
        .complete(function (err) {
            if (err) {
                return done(err);
            }

            // Synchronize the db
            db.sync({ force: true }).complete(function (err) {
                done(err);
            });
        });
};

describe('Passport Local Sequelize', function () {
    before(function (done) {
        initDb(done);
    });

    beforeEach(function (done) {
        // Delete all users
        User.destroy({}, { truncate: true })
            .success(function () {
                done();
            })
            .error(done);
    });

    it('can define a User schema for you', function () {
        should.exist(User);
        _.isFunction(User.getByToken).should.equal(true);
    });

    it('can register and authenticate a user', function (done) {
        should.exist(User.register);

        User.register('someuser', 'somepass', function (err, registeredUser) {
            if (err) {
                return done(err);
            }

            registeredUser.get('username').should.equal('someuser');
            registeredUser.get('id').should.be.above(0);

            registeredUser.authenticate('badpass', function (err, authenticated) {
                if (err) {
                    return done(err);
                }

                authenticated.should.equal(false);

                registeredUser.authenticate('somepass', function (err, authenticatedUser) {
                    if (err) {
                        return done(err);
                    }

                    authenticatedUser.should.not.equal(false);

                    authenticatedUser.get('username').should.equal('someuser');

                    _.isFunction(authenticatedUser.generateToken).should.equal(true);

                    authenticatedUser.generateToken();
                    authenticatedUser.token.should.equal('1234');
                    authenticatedUser.save()
                        .success(function () {
                            User.getByToken('1234')
                                .success(function (found) {
                                    found.get('username').should.equal('someuser');

                                    done();
                                })
                                .error(function (err) {
                                    done(err);
                                });
                        })
                        .error(function (err) {
                            done(err);
                        });
                });
            });
        });
    });
});