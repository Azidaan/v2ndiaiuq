export class BcryptPasswordHasher {
  constructor(bcrypt, rounds = 12) {
    this.bcrypt = bcrypt;
    this.rounds = rounds;
  }

  hash(password) {
    return this.bcrypt.hash(password, this.rounds);
  }

  verify(password, hash) {
    return this.bcrypt.compare(password, hash);
  }
}
