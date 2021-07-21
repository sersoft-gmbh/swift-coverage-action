import XCTest
@testable import TestProject2

final class SomeObjectTests: XCTestCase {
    func testSomeObject() throws {
        XCTAssertEqual(SomeObject(name: "Test"), SomeObject(name: "Test"))
        XCTAssertNotEqual(SomeObject(name: "Test1"), SomeObject(name: "Test2"))
    }
}
