import TodoListItem from "./TodoListItem"

const TodoList = ({ todos = [] }) => {
  return (
    <div>
      {todos.map((todo) => (
        <TodoListItem key={todo.title} todo={todo} />
      ))}
    </div>
  )
}
export default TodoList
