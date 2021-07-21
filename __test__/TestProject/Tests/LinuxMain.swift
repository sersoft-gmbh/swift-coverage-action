import XCTest

import TestProject1Tests
import TestProject2Tests

var tests = [XCTestCaseEntry]()
tests += TestProject1Tests.__allTests()
tests += TestProject2Tests.__allTests()

XCTMain(tests)
