import { useState } from "react"
import { isError, useMutation } from "react-query"
import { queryClient } from "../pages/_app"

const TodoListItem = ({ todo }) => {
  const [title, setTitle] = useState(todo.title)
  const { mutate: updateTodo } = useMutation(
    ({ title }) =>
      new Promise((resolve) => {
        setTimeout(() => resolve(title), 1000)
      }),
    {
      onSuccess: () => {
        // queryClient.invalidateQueries("todos")
        console.log("mutation success")
      },
    }
  )

  console.log("rendered")

  const onChange = (e) => {
    updateTodo({ title: e.target.value })
  }

  return (
    <div>
      <input value={title} onChange={onChange} />
    </div>
  )
}

export default TodoListItem
