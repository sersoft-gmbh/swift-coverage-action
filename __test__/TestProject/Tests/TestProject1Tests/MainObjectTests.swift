import XCTest
@testable import TestProject1

final class MainObjectTests: XCTestCase {
    struct Stream: TextOutputStream {
        private var _string: String = ""

        mutating func write(_ string: String) {
            _string += string
        }

        mutating func finalize() -> String {
            defer { _string = "" }
            return _string
        }
    }

    func testSomeEnum() throws {
        XCTAssertFalse(SomeEnum.a.isB)
        XCTAssertTrue(SomeEnum.b.isB)
    }

    func testSomeClass() throws {
        let cls = SomeClass()
        var stream = Stream()
        cls.sayHello(to: &stream)
        XCTAssertEqual(stream.finalize(), "Hello\n")
    }
}
