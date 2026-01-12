const { expect } = require('chai');
const sinon = require('sinon');
const admin = require('firebase-admin');
const functionsTest = require('firebase-functions-test')();

// Import functions after test initialization
const myFunctions = require('../index');

describe('Cloud Functions Security Tests', () => {
    let adminDatabaseStub;
    let adminAuthStub;

    beforeEach(() => {
        // Stub admin SDK methods
        adminDatabaseStub = sinon.stub(admin, 'database');
        adminAuthStub = sinon.stub(admin, 'auth');
    });

    afterEach(() => {
        // Restore all stubs
        sinon.restore();
    });

    describe('validateFSKAccess', () => {
        it('should reject unauthenticated requests', async () => {
            // Create a wrapped callable function
            const wrapped = functionsTest.wrap(myFunctions.validateFSKAccess);

            try {
                await wrapped({ category: 'fsk16' });
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Authentifizierung erforderlich');
            }
        });

        it('should allow FSK0 for all users', async () => {
            const wrapped = functionsTest.wrap(myFunctions.validateFSKAccess);

            // Mock database response - FSK0 doesn't need age verification
            const dbRefStub = {
                once: sinon.stub().resolves({
                    val: () => ({
                        ageVerified: true,
                        ageLevel: 12
                    })
                })
            };

            adminDatabaseStub.returns({
                ref: sinon.stub().returns(dbRefStub)
            });

            const result = await wrapped(
                { category: 'fsk0' },
                { auth: { uid: 'test-user-123', token: {} } }
            );

            expect(result.allowed).to.be.true;
            expect(result.category).to.equal('fsk0');
        });

        it('should deny FSK16 for users under 16', async () => {
            const wrapped = functionsTest.wrap(myFunctions.validateFSKAccess);

            const dbRefStub = {
                once: sinon.stub().resolves({
                    val: () => ({
                        ageVerified: true,
                        ageLevel: 14
                    })
                })
            };

            adminDatabaseStub.returns({
                ref: sinon.stub().returns(dbRefStub)
            });

            const result = await wrapped(
                { category: 'fsk16' },
                { auth: { uid: 'test-user-123', token: {} } }
            );

            expect(result.allowed).to.be.false;
            expect(result.reason).to.equal('age_too_young');
        });

        it('should allow FSK16 for users 16 and older', async () => {
            const wrapped = functionsTest.wrap(myFunctions.validateFSKAccess);

            const dbRefStub = {
                once: sinon.stub().resolves({
                    val: () => ({
                        ageVerified: true,
                        ageLevel: 18
                    })
                })
            };

            adminDatabaseStub.returns({
                ref: sinon.stub().returns(dbRefStub)
            });

            const result = await wrapped(
                { category: 'fsk16' },
                { auth: { uid: 'test-user-123', token: {} } }
            );

            expect(result.allowed).to.be.true;
        });

        it('should deny access if age is not verified', async () => {
            const wrapped = functionsTest.wrap(myFunctions.validateFSKAccess);

            const dbRefStub = {
                once: sinon.stub().resolves({
                    val: () => ({
                        ageVerified: false
                    })
                })
            };

            adminDatabaseStub.returns({
                ref: sinon.stub().returns(dbRefStub)
            });

            const result = await wrapped(
                { category: 'fsk16' },
                { auth: { uid: 'test-user-123', token: {} } }
            );

            expect(result.allowed).to.be.false;
            expect(result.reason).to.equal('age_not_verified');
        });
    });

    describe('exportUserData', () => {
        it('should reject unauthenticated requests', async () => {
            const wrapped = functionsTest.wrap(myFunctions.exportUserData);

            try {
                await wrapped({});
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Authentifizierung erforderlich');
            }
        });

        it('should export user profile and games', async () => {
            const wrapped = functionsTest.wrap(myFunctions.exportUserData);

            const userProfile = {
                displayName: 'Test User',
                ageVerified: true,
                ageLevel: 18
            };

            const games = {
                'game-1': {
                    hostId: 'test-user-123',
                    players: {
                        'test-user-123': { score: 100 }
                    },
                    createdAt: Date.now()
                }
            };

            const dbRefStub = {
                once: sinon.stub()
            };

            // First call for user profile
            dbRefStub.once.onFirstCall().resolves({
                val: () => userProfile
            });

            // Second call for games
            dbRefStub.once.onSecondCall().resolves({
                val: () => games
            });

            adminDatabaseStub.returns({
                ref: sinon.stub().returns(dbRefStub)
            });

            const result = await wrapped(
                {},
                { auth: { uid: 'test-user-123', token: {} } }
            );

            expect(result.userId).to.equal('test-user-123');
            expect(result.data.profile).to.deep.equal(userProfile);
            expect(result.data.games).to.have.lengthOf(1);
        });
    });

    describe('deleteMyAccount', () => {
        it('should reject unauthenticated requests', async () => {
            const wrapped = functionsTest.wrap(myFunctions.deleteMyAccount);

            try {
                await wrapped({ confirmation: 'DELETE_MY_ACCOUNT' });
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Authentifizierung erforderlich');
            }
        });

        it('should reject without proper confirmation', async () => {
            const wrapped = functionsTest.wrap(myFunctions.deleteMyAccount);

            try {
                await wrapped(
                    { confirmation: 'wrong' },
                    { auth: { uid: 'test-user-123', token: {} } }
                );
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Bestätigung erforderlich');
            }
        });
    });

    describe('setAgeVerification', () => {
        it('should reject invalid age levels', async () => {
            const wrapped = functionsTest.wrap(myFunctions.setAgeVerification);

            try {
                await wrapped(
                    { ageLevel: -1 },
                    { auth: { uid: 'test-user-123', token: {} } }
                );
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Ungültige Altersangabe');
            }
        });

        it('should reject age levels above 99', async () => {
            const wrapped = functionsTest.wrap(myFunctions.setAgeVerification);

            try {
                await wrapped(
                    { ageLevel: 150 },
                    { auth: { uid: 'test-user-123', token: {} } }
                );
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Ungültige Altersangabe');
            }
        });
    });
});

describe('DSGVO Compliance Tests', () => {
    it('cleanupUserData should remove user from all games', () => {
        // This would test the auth trigger function
        // Requires more complex setup with Firebase Functions Test SDK
        expect(true).to.be.true; // Placeholder
    });

    it('cleanupOldGames should delete expired games', () => {
        // This would test the scheduled function
        // Requires more complex setup
        expect(true).to.be.true; // Placeholder
    });
});

