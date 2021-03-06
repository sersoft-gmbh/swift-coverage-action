/// This is an exemplary enumeration.
public enum SomeEnum: Equatable {
    /// The A case
    case a
    /// The B case
    case b
    /// The C case
    case c

    /// Returns whether self is equal to ``b``.
    public var isB: Bool { self == .b }
}

/// This is an exemplary final class.
public final class SomeClass {
    /// Simply creates a new instance of this class.
    public init() {}

    /// This prints 'Hello' into the given stream.
    public func sayHello<S: TextOutputStream>(to stream: inout S) {
        print("Hello", to: &stream)
    }
}
