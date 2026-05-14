
export interface QuestionTemplate {
    q: string;
    o: { [key: string]: string };
    ans: string;
    points: number;
}

export const UNIQUE_QUESTIONS_POOL: QuestionTemplate[] = [
    { q: 'Which design pattern is most appropriate for managing application state?', o: { A: 'Singleton', B: 'Redux/State Management', C: 'Factory', D: 'Observer' }, ans: 'B', points: 4 },
    { q: 'What is the time complexity of binary search?', o: { A: 'O(n)', B: 'O(n log n)', C: 'O(log n)', D: 'O(1)' }, ans: 'C', points: 3 },
    { q: 'Which principle advocates that objects should be open for extension but closed for modification?', o: { A: 'Single Responsibility', B: 'Open/Closed', C: 'Liskov Substitution', D: 'Dependency Inversion' }, ans: 'B', points: 4 },
    { q: 'What does REST stand for?', o: { A: 'Representational State Transfer', B: 'Remote Execution Service Toolkit', C: 'Resource Extension Security Token', D: 'Real-time Event Stream Transfer' }, ans: 'A', points: 3 },
    { q: 'Which of these is NOT a valid HTTP method?', o: { A: 'GET', B: 'POST', C: 'RETRIEVE', D: 'DELETE' }, ans: 'C', points: 3 },
    { q: 'What is the time complexity of searching a Hash Table under worst-case collision?', o: { A: 'O(1)', B: 'O(N)', C: 'O(log N)', D: 'O(N log N)' }, ans: 'B', points: 4 },
    { q: 'Which of the following breaks the CAP Theorem?', o: { A: 'Spanner', B: 'Aurora', C: 'MongoDB', D: 'None, it is mathematically impossible' }, ans: 'D', points: 4 },
    { q: 'In a microservice architecture, how do you handle distributed transactions safely?', o: { A: '2PC', B: 'Saga Pattern', C: 'Event Sourcing', D: 'Both B and C' }, ans: 'D', points: 4 },
    { q: 'Which HTTP status code signifies a conflict in the current state of the resource?', o: { A: '400', B: '401', C: '409', D: '422' }, ans: 'C', points: 3 },
    { q: 'What dictates the execution context of `this` in JavaScript?', o: { A: 'Where it was written', B: 'How the function is called', C: 'The window object', D: 'The prototype chain' }, ans: 'B', points: 3 },
    { q: 'What is the main purpose of a 100-continue status in HTTP?', o: { A: 'Success', B: 'Check if server accepts request', C: 'Redirect', D: 'Error' }, ans: 'B', points: 3 },
    { q: 'Which data structure is typically used for implementing a BFS algorithm?', o: { A: 'Stack', B: 'Heap', C: 'Queue', D: 'Tree' }, ans: 'C', points: 3 },
    { q: 'A train 150m long is running at 54 km/hr. How much time will it take to pass a platform 250m long?', o: { A: '20.6s', B: '26.6s', C: '30.3s', D: 'None' }, ans: 'B', points: 4 },
    { q: 'If A is twice as efficient as B and together they finish a work in 14 days, how long will A take alone?', o: { A: '21 days', B: '24 days', C: '28 days', D: '42 days' }, ans: 'A', points: 4 },
    { q: 'Six bells commence tolling together and toll at intervals of 2, 4, 6, 8, 10 and 12 seconds. In 30 minutes, how many times do they toll together?', o: { A: '4', B: '10', C: '15', D: '16' }, ans: 'D', points: 4 },
    { q: 'Solve: (256)^0.16 * (256)^0.09 = ?', o: { A: '4', B: '16', C: '64', D: '256.25' }, ans: 'A', points: 4 },
    { q: 'What is the average of first 50 natural numbers?', o: { A: '25.0', B: '25.5', C: '26.0', D: '24.5' }, ans: 'B', points: 3 },
    { q: 'The LCM of two numbers is 48. The numbers are in the ratio 2:3. What is the sum of the numbers?', o: { A: '28', B: '32', C: '40', D: '64' }, ans: 'C', points: 4 },
    { q: 'In React, what is the purpose of the `useMemo` hook?', o: { A: 'Side effects', B: 'State management', C: 'Memoize computations', D: 'DOM access' }, ans: 'C', points: 3 },
    { q: 'Which SQL join returns all records when there is a match in either left or right table?', o: { A: 'Inner', B: 'Left', C: 'Full Outer', D: 'Right' }, ans: 'C', points: 3 },
    { q: 'A person crosses a 600m long street in 5 minutes. What is his speed in km/hr?', o: { A: '3.6', B: '7.2', C: '8.4', D: '10' }, ans: 'B', points: 3 },
    { q: 'A fruit seller had some apples. He sells 40% apples and still has 420 apples. Originally he had...?', o: { A: '588', B: '600', C: '672', D: '700' }, ans: 'D', points: 3 },
    { q: 'What is the default port for PostgreSQL?', o: { A: '3306', B: '5432', C: '8080', D: '27017' }, ans: 'B', points: 2 },
    { q: 'Which property of CSS is used to change the text color?', o: { A: 'font-color', B: 'text-style', C: 'color', D: 'background' }, ans: 'C', points: 2 },
    { q: 'What is the result of `typeof null` in JavaScript?', o: { A: 'null', B: 'undefined', C: 'object', D: 'string' }, ans: 'C', points: 3 },
    { q: 'Which algorithm is used for finding the shortest path in a weighted graph without negative edges?', o: { A: 'Prim', B: 'Kruskal', C: 'Dijkstra', D: 'Bellman-Ford' }, ans: 'C', points: 4 },
    { q: 'If 20% of a = b, then b% of 20 is the same as...?', o: { A: '4% of a', B: '5% of a', C: '20% of a', D: 'None' }, ans: 'A', points: 4 },
    { q: 'A sum of money at simple interest amounts to Rs. 815 in 3 years and to Rs. 854 in 4 years. The sum is...?', o: { A: 'Rs. 650', B: 'Rs. 690', C: 'Rs. 698', D: 'Rs. 700' }, ans: 'C', points: 4 },
    { q: 'Which principle of the Agile Manifesto emphasizes working software over comprehensive documentation?', o: { A: 'Principle 1', B: 'Principle 2', C: 'Principle 5', D: 'Principle 10' }, ans: 'B', points: 3 },
    { q: 'What is the primary vulnerability prevented by CSRF tokens?', o: { A: 'XSS', B: 'SQL Injection', C: 'State-changing forgery', D: 'Clickjacking' }, ans: 'C', points: 4 },
];
