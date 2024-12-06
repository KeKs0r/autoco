class Calculator {
  constructor() {}

  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Cannot divide by zero");
    }
    return a / b;
  }

  power(base: number, exponent: number): number {
    return Math.pow(base, exponent);
  }

  sqrt(num: number): number {
    if (num < 0) {
      throw new Error("Cannot calculate square root of negative number");
    }
    return Math.sqrt(num);
  }
}
