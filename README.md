# Server State 💔 Client State

## 개요

현재 진행하고 있는 프로젝트는 PWA기반 프로젝트이고 오프라인 환경을 지원해야합니다. 따라서 `서버의 상태`와 `클라이언트의 상태`를 명확하게 정의하고 관리해야합니다.

상태를 명확하게 정의한다면 PWA의 주요기능인 `백그라운드 동기화`를 구현할 수 있습니다.

`상태`란 주어진 시간에 대해 시스템을 나타내는 것으로 언제든지 변경될 수 있는 것입니다.

애플리케이션의 상태는 `Server State`와 `Client State`로 분류할 수 있습니다.

### Server State

- 서버 상태는 사용자의 제어를 벗어난 위치에서 원격으로 유지된다.
- 비동기 요청을 통해 `fetching` 또는 `updating`이 가능하다.
- 소유권을 공유한다. 즉 사용자 모르게 다른 사용자가 변경할 수 있다.
- 시간이 지남에 따라 `stale` 또는 `outdated`된다.

### Client State

## 문제 정의

현재 프로젝트의 상황을 간략하게 표현해 보겠습니다.

```js
const Home = () => {
  const { data: todos } = useTodoListQuery()

  return <TodoList todos={todos} />
}
```

react-query를 사용해서 다음과 같이 메인 페이지에서 TodoList를 서버에서 불러옵니다. 즉 `CSR`입니다.

```js
const TodoList = ({ todos = [] }) => {
  return (
    <div>
      {todos.map((todo, index) => (
        <TodoListItem key={index} todo={todo} />
      ))}
    </div>
  )
}
```

`TodoList`는 그 데이터를 활용해서 `TodoListItem`에 내려줍니다.

```js
const TodoListItem = ({ todo }) => {
  const [title, setTitle] = useState(todo.title)
  const { mutate: updateTodo, isLoading } = useMutation(
    ({ title }) => todoService.updateTodo({ title }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries("todos")
      },
    }
  )

  const onChange = (e) => {
    setTitle(e.target.value)
    updateTodo({ title: e.target.value })
  }

  if (isLoading) {
    return <div>로딩중</div>
  }

  return (
    <div>
      <input value={title} onChange={onChange} />
    </div>
  )
}
```

`TodoListItem`에서는 input에 값을 그대로 넣어주고 이 input값의 변화를 상태로 관리하기 위해 서버로 부터 받아온 상태를 클라이언트 컴포넌트의 상태로 관리하고 있습니다.

만약 리덕스와 같은 상태관리 라이브러리를 쓴다면 아래와 같이 할 수 있습니다.

```js
const { data: todos } = useTodoListQuery()

useEffect(() => {
  dispatch(storeTodo(todos))
}, [dispatch, todos])
```

이제 우리는 서버의 상태를 클라이언트 상태로 `둔갑`시켜서 관리하고 있는 상태가 됩니다.(서버 상태이기도 하고 클라이언트 상태이기도 합니다.)

이 `flow`를 다이어그램으로 그려보면 아래와 같습니다.

![](https://velog.velcdn.com/images/hyunjine/post/fe30c0f0-71ff-46c7-972f-6ae101fee0a5/image.png)

1. react-query가 데이터를 fetching하고 props로 내려주면서 하위 컴포넌트는 그 props를 상태로 갖는다.
2. 유저가 그 컴포넌트의 상태를 변경한다.
3. onChange 함수가 호출 될 때 서버에 알려주기 위해 mutate를 호출한다.
   `3-1`. onSuccess callback을 호출하여 데이터를 불러오는 쿼리를 무효화하고 데이터를 다시 가져온다.
   `3-2`. onSuccess callback에서 아무것도 하지 않는다.(서버의 상태는 바뀌어도 refetch는 하지않는다.)

브라우저가 온라인 상태라면`3-1`과 `3-2` 모두 해결방안이 될 수 있습니다.
Todo 애플리케이션의 특성상 자신의 Todo는 다른사람에 의해 바뀌지 않으므로 `3-1`과 같이 Todo를 업데이트만 하면되고 다시 `refetching`은 하지 않아도 됩니다. 또한 `3-2`는 더 많은 리렌더링을 유발합니다.

페이지가 새로고침된다면(온라인) 어짜피 react-query가 새로운 서버 상태(todos)를 가져오므로 문제없이 동작합니다.

## 오프라인 환경

브라우저가 오프라인 상태라면 react-query의 요청이 서버에 전달되지 않습니다.

대신에 로컬 데이터베이스에서 데이터를 가져올 수 있겠죠.

저는 react-query가 가져온 데이터가 `stale`한 데이터인가 고민해보았습니다.(`stale`한 상태는 신선하지 않은 상태를 의미합니다.)

데이터가 클라이언트에게 한번 전해지면 클라이언트는 해당 데이터가 최신 데이터인지 더 이상 알 수 없습니다. 하지만 그 데이터가 사용자 자신의 데이터라면 어떨까요?

서버에서 TodoList를 가져오고 사용자가 수정하기 전 상태라면 무조건 신선한 데이터입니다. 또한 사용자의 수정을 상태로 계속 관리해준다면 신선한 데이터를 유지할 수 있습니다.

이러한 사실에 착안하면 서버로부터 TodoList를 한번 받아와서 브라우저의 데이터베이스에 저장하고 상태를 변경할 때 브라우저의 데이터베이스를 동기화시켜준다면 오프라인 상태에서 다시 재접속 해도 최신 상태의 TodoList를 유지할 수 있습니다.(기본적인 정적 파일들은 브라우저에 모두 캐싱 되어있다고 가정합니다.)

사용자의 네트워크 상태가 온라인으로 바뀐다면 PWA의 `백그라운드 동기화`를 이용해서 로컬 데이터를 서버와 동기화 시키면 됩니다.

## 해결 방안

useQuery를 사용할 때 `stale` 타임을 지정할 수 있습니다. 즉 개발자가 임의로 받아온 데이터가 신선하지 않게되는 시간을 지정할 수 있습니다.

TodoList는 사용자가 데이터를 받아온다면 수정하기 전까지 `stale`해지지 않습니다.

`stale` 해지지 않는다는 것은 주기적으로 데이터를 `refetching`하는 것이 필요하지 않음을 의미합니다.

저는 여기서 "꼭 `useQuery`로 데이터를 받아와야하나?" 라는 생각을 했습니다.

`서버 상태`와 `클라이언트 상태`가 결합할 수 밖에 없는 경우에 `useQuery`를 통해 데이터를 받아오면 관심사의 분리가 잘 되지 않습니다.

제 생각에는 이를 `SSR`(서버 사이드 렌더링)으로 해결할 수 있습니다.

서버에서 서버의 상태를 주입해서 클라이언트에게 보내준다면 클라이언트는 서버의 상태를 처음부터 클라이언트 상태처럼 다룰 수 있습니다. 또한 리액트 쿼리의 옵션(`refetchOnMount`, `refetchOnWindowFocus`, `refetchOnReconnect`, `staleTime`)을 신경쓰지 않아도 됩니다.

데이터를 수정했다면 서버에 수정했다고 전달만 하면 됩니다.
