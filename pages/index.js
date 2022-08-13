import { useQuery } from "react-query"
import TodoList from "../components/TodoList"

const Home = () => {
  const { data: todos } = useQuery(
    ["todos"],
    () =>
      new Promise((resolve) =>
        setTimeout(() => resolve([{ title: "todo1" }]), 1000)
      ),
    {
      onSuccess: () => console.log("success queries"),
    }
  )

  return (
    <div>
      <TodoList todos={todos} />
    </div>
  )
}

export default Home
